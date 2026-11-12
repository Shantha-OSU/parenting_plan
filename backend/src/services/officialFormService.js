const crypto = require('crypto');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');

const FORM_IDS = new Set(['oh-dr-form-20', 'oh-dr-form-21']);
const NON_FINAL_VALUES = new Set(['needMoreInfo', 'defaultToCoParent']);
const CUSTOM_SOURCE_KEYS = new Set([
  'parentingTimeAndCommunication.parentingSchedule',
  'parentingTimeAndCommunication.holidaySchedule',
  'parentingTimeAndCommunication.schoolSchedule',
  'parentingTimeAndCommunication.parentingSchedulesByChild',
  'parentingTimeAndCommunication.holidaySchedulesByChild',
  'parentingTimeAndCommunication.schoolSchedulesByChild',
  'parentingTimeAndCommunication.scheduleScope',
  'taxExemptions.parentRole',
  'taxExemptions.claimingChildren',
  'taxExemptions.childAnswers',
  'children',
  'parentFName',
  'parentLName',
  'userRole',
  'currentCircumstance',
  'caseFilingStatus',
  'courtCustodyOrderIssued',
  'custodyGrantedTo',
]);

function assertFormId(formId) {
  if (!FORM_IDS.has(formId)) throw new Error('Unsupported official form');
}

function classifyField(field) {
  const name = field.constructor?.name || '';
  if (name.includes('TextField')) return 'text';
  if (name.includes('CheckBox')) return 'checkbox';
  if (name.includes('RadioGroup')) return 'radio';
  if (name.includes('Dropdown') || name.includes('OptionList')) return 'dropdown';
  return 'unknown';
}

function getFieldOptions(field) {
  if (typeof field.getOptions === 'function') return field.getOptions();
  return [];
}

async function inspectPdfFields(pdfBytes) {
  const document = await PDFDocument.load(pdfBytes, { updateMetadata: false });
  const form = document.getForm();
  const pages = document.getPages();
  const fields = form.getFields().map((field) => {
    const widgets = typeof field.getWidgets === 'function' ? field.getWidgets() : [];
    const widget = widgets[0];
    const rect = widget && typeof widget.getRectangle === 'function' ? widget.getRectangle() : null;
    const pageRef = widget?.P();
    const page = pageRef ? pages.findIndex((candidate) => candidate.ref === pageRef) + 1 : 1;
    return {
      name: field.getName(),
      type: classifyField(field),
      page: page || 1,
      rect: rect ? {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      } : undefined,
      options: getFieldOptions(field),
    };
  });
  return { fields, isFillable: fields.length > 0, pageCount: pages.length };
}

function sha256(pdfBytes) {
  return crypto.createHash('sha256').update(pdfBytes).digest('hex');
}

function toAnswerMap(source) {
  if (!source) return {};
  if (Array.isArray(source)) return Object.fromEntries(source.map(({ qKey, answer }) => [qKey, answer]));
  return source;
}

function getNestedValue(value, path) {
  if (value && Object.prototype.hasOwnProperty.call(value, path)) return value[path];
  return path.split('.').reduce((current, key) => current == null ? undefined : current[key], value);
}

function resolveAnswer(answers, rule) {
  if (!rule || typeof rule !== 'object') throw new Error('Mapping rule must be an object');
  if (rule.source !== 'answer') throw new Error('Mapping rules must use the answer source');
  const value = getNestedValue(answers, rule.qKey);
  if (NON_FINAL_VALUES.has(value)) return { value: undefined, needsAttention: true };
  if (rule.type === 'direct') return { value };
  if (rule.type === 'valueMap') {
    const mapped = rule.values && Object.prototype.hasOwnProperty.call(rule.values, String(value))
      ? rule.values[String(value)]
      : undefined;
    return { value: mapped };
  }
  throw new Error(`Unsupported mapping rule type: ${rule.type}`);
}

function isKnownCustomKey(qKey) {
  return CUSTOM_SOURCE_KEYS.has(qKey) || qKey.startsWith('taxExemptions.childAnswers.');
}

async function validateSourceKeys(fields) {
  const qKeys = fields.map(({ rule }) => rule?.qKey).filter(Boolean);
  const databaseKeys = qKeys.filter((qKey) => !isKnownCustomKey(qKey));
  if (databaseKeys.length === 0) return;
  const Question = require('../models/Question');
  const questions = await Question.find({ qKey: { $in: databaseKeys } }).select('qKey isArchived').lean();
  const byKey = new Map(questions.map((question) => [question.qKey, question]));
  for (const qKey of qKeys) {
    if (isKnownCustomKey(qKey)) continue;
    const question = byKey.get(qKey);
    if (!question) throw new Error(`Unknown mapping source: ${qKey}`);
    if (question.isArchived) throw new Error(`Archived mapping source: ${qKey}`);
  }
}

function fieldTargetKey(field) {
  if (field.pdfField) return `field:${field.pdfField}`;
  if (field.overlay) return `overlay:${field.overlay.page}:${field.overlay.x}:${field.overlay.y}`;
  return null;
}

async function validateMapping(version, fields, { allowNeedsReview = true } = {}) {
  if (!Array.isArray(fields)) throw new Error('Mapping fields must be an array');
  await validateSourceKeys(fields);
  const inventory = new Map(version.fieldInventory.map((field) => [field.name, field]));
  const targets = new Set();
  for (const field of fields) {
    if (!field || !['text', 'checkbox', 'radio', 'dropdown'].includes(field.type) || !field.rule) {
      throw new Error('Invalid mapping field');
    }
    const target = fieldTargetKey(field);
    if (!target || targets.has(target)) throw new Error('Mapping targets must be unique and explicit');
    targets.add(target);
    if (field.pdfField) {
      const inventoryField = inventory.get(field.pdfField);
      if (!inventoryField) throw new Error(`Mapping references missing PDF field: ${field.pdfField}`);
      if (inventoryField.type !== field.type) throw new Error(`Mapping type does not match PDF field: ${field.pdfField}`);
      if (!allowNeedsReview && field.reviewStatus === 'needs_review') {
        throw new Error(`Mapping needs review: ${field.pdfField}`);
      }
    } else if (version.isFillable) {
      throw new Error('Coordinate overlays are only valid for flat PDFs');
    } else if (!Number.isInteger(field.overlay.page) || field.overlay.page < 1 ||
      !Number.isFinite(field.overlay.x) || !Number.isFinite(field.overlay.y)) {
      throw new Error('Invalid overlay target');
    }
  }
  return true;
}

function compareInventory(oldInventory, newInventory) {
  const oldByName = new Map(oldInventory.map((field) => [field.name, field]));
  const newByName = new Map(newInventory.map((field) => [field.name, field]));
  const added = newInventory.filter((field) => !oldByName.has(field.name)).map((field) => field.name);
  const removed = oldInventory.filter((field) => !newByName.has(field.name)).map((field) => field.name);
  const typeChanged = [];
  const optionChanged = [];
  for (const [name, oldField] of oldByName) {
    const newField = newByName.get(name);
    if (!newField) continue;
    if (oldField.type !== newField.type) typeChanged.push(name);
    if (JSON.stringify(oldField.options || []) !== JSON.stringify(newField.options || [])) optionChanged.push(name);
  }
  return { added, removed, typeChanged, optionChanged };
}

async function fillOfficialForm(version, mapping, answers, { flatten = true } = {}) {
  await validateMapping(version, mapping.fields);
  const document = await PDFDocument.load(version.pdfData, { updateMetadata: false });
  const form = document.getForm();
  const attention = [];
  for (const field of mapping.fields) {
    const result = resolveAnswer(answers, field.rule);
    if (result.needsAttention) {
      attention.push({ target: fieldTargetKey(field), qKey: field.rule.qKey, reason: 'non-final-answer' });
      continue;
    }
    if (field.pdfField) {
      const target = form.getField(field.pdfField);
      if (field.type === 'text') target.setText(result.value == null ? '' : String(result.value));
      else if (field.type === 'checkbox') result.value ? target.check() : target.uncheck();
      else if (field.type === 'radio' || field.type === 'dropdown') target.select(String(result.value ?? ''));
    } else {
      const page = document.getPages()[field.overlay.page - 1];
      if (!page) throw new Error(`Overlay page does not exist: ${field.overlay.page}`);
      const text = field.type === 'checkbox' ? (result.value ? '✓' : '') : String(result.value ?? '');
      if (text) {
        const font = await document.embedFont(StandardFonts.Helvetica);
        page.drawText(text, {
          x: field.overlay.x,
          y: field.overlay.y,
          size: field.overlay.size || 10,
          font,
          color: rgb(0, 0, 0),
        });
      }
    }
  }
  form.updateFieldAppearances();
  if (flatten) form.flatten();
  return { bytes: await document.save(), attention };
}

module.exports = {
  FORM_IDS,
  assertFormId,
  inspectPdfFields,
  sha256,
  toAnswerMap,
  resolveAnswer,
  validateMapping,
  compareInventory,
  fillOfficialForm,
};
