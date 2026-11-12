const express = require('express');
const multer = require('multer');
const OfficialFormVersion = require('../models/OfficialFormVersion');
const OfficialFormMapping = require('../models/OfficialFormMapping');
const {
  assertFormId,
  inspectPdfFields,
  sha256,
  compareInventory,
  validateMapping,
  fillOfficialForm,
  toAnswerMap,
} = require('../services/officialFormService');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024, files: 1 },
});
const MAX_HISTORY_ENTRIES = 50;

function snapshotMapping(mapping) {
  return { fields: mapping.fields };
}

function appendRevision(mapping, before, after, actorUid) {
  if (!Array.isArray(mapping.revisionHistory)) mapping.revisionHistory = [];
  mapping.revisionHistory.push({
    actorUid,
    changedAt: new Date(),
    before,
    after,
  });
  if (mapping.revisionHistory.length > MAX_HISTORY_ENTRIES) {
    mapping.revisionHistory.splice(0, mapping.revisionHistory.length - MAX_HISTORY_ENTRIES);
  }
}

function publicVersion(version) {
  const result = version.toObject ? version.toObject() : version;
  delete result.pdfData;
  return result;
}

function carryMapping(mapping, oldVersion, newVersion) {
  if (!mapping) {
    return { fields: [], carriedCleanly: 0, needsReview: 0 };
  }
  if (!newVersion.isFillable || !oldVersion?.isFillable) {
    return {
      fields: mapping.fields.map((field) => ({ ...field.toObject?.() || field, reviewStatus: 'needs_review' })),
      carriedCleanly: 0,
      needsReview: mapping.fields.length,
    };
  }
  const oldFields = new Map(oldVersion.fieldInventory.map((field) => [field.name, field]));
  const newFields = new Map(newVersion.fieldInventory.map((field) => [field.name, field]));
  let carriedCleanly = 0;
  let needsReview = 0;
  const fields = mapping.fields.map((field) => {
    const oldTarget = oldFields.get(field.pdfField);
    const newTarget = newFields.get(field.pdfField);
    const optionsCompatible = JSON.stringify(oldTarget?.options || []) === JSON.stringify(newTarget?.options || []);
    const clean = newTarget && oldTarget?.type === newTarget.type &&
      field.type === newTarget.type && (field.type === 'text' || optionsCompatible);
    if (clean) {
      carriedCleanly += 1;
      return { ...field.toObject?.() || field, reviewStatus: 'ok' };
    }
    needsReview += 1;
    return { ...field.toObject?.() || field, reviewStatus: 'needs_review' };
  });
  return { fields, carriedCleanly, needsReview };
}

router.get('/official-forms/:formId/versions', async (req, res) => {
  try {
    assertFormId(req.params.formId);
    const versions = await OfficialFormVersion.find({ formId: req.params.formId })
      .sort({ createdAt: -1 }).lean();
    return res.json({ versions: versions.map(publicVersion) });
  } catch (error) {
    return res.status(error.message === 'Unsupported official form' ? 400 : 500)
      .json({ error: error.message });
  }
});

router.post('/official-forms/:formId/versions', upload.single('pdf'), async (req, res) => {
  try {
    assertFormId(req.params.formId);
    if (!req.file || typeof req.body.revisionLabel !== 'string' || !req.body.revisionLabel.trim()) {
      return res.status(400).json({ error: 'PDF and revisionLabel are required' });
    }
    if (!req.file.buffer.subarray(0, 5).equals(Buffer.from('%PDF-'))) {
      return res.status(400).json({ error: 'Uploaded file is not a PDF' });
    }
    const hash = sha256(req.file.buffer);
    if (await OfficialFormVersion.exists({ formId: req.params.formId, pdfSha256: hash })) {
      return res.status(409).json({ error: 'This PDF version already exists' });
    }
    const inspected = await inspectPdfFields(req.file.buffer);
    const oldVersion = await OfficialFormVersion.findOne({
      formId: req.params.formId,
      status: 'active',
    }).select('+pdfData');
    const oldMapping = oldVersion
      ? await OfficialFormMapping.findOne({ versionId: oldVersion._id })
      : null;
    const version = await OfficialFormVersion.create({
      formId: req.params.formId,
      revisionLabel: req.body.revisionLabel.trim(),
      pdfSha256: hash,
      pdfData: req.file.buffer,
      fieldInventory: inspected.fields,
      isFillable: inspected.isFillable,
      status: 'draft',
      uploadedBy: req.user.uid,
    });
    const carried = carryMapping(oldMapping, oldVersion, version);
    const mapping = await OfficialFormMapping.create({
      versionId: version._id,
      fields: carried.fields,
      updatedBy: req.user.uid,
    });
    const diff = compareInventory(oldVersion?.fieldInventory || [], inspected.fields);
    const mappedNames = new Set(carried.fields.map((field) => field.pdfField).filter(Boolean));
    diff.unmapped = inspected.fields.filter((field) => !mappedNames.has(field.name)).map((field) => field.name);
    return res.status(201).json({
      version: publicVersion(version),
      mapping: mapping.toObject(),
      diff: {
        ...diff,
        carriedCleanly: carried.carriedCleanly,
        needsReview: carried.needsReview,
      },
    });
  } catch (error) {
    console.error('Could not upload official form:', error);
    return res.status(error.name === 'MulterError' ? 413 : 400).json({ error: error.message });
  }
});

router.get('/official-forms/:formId/versions/:versionId', async (req, res) => {
  try {
    assertFormId(req.params.formId);
    const version = await OfficialFormVersion.findOne({
      _id: req.params.versionId,
      formId: req.params.formId,
    }).lean();
    if (!version) return res.status(404).json({ error: 'Form version not found' });
    const mapping = await OfficialFormMapping.findOne({ versionId: version._id }).lean();
    const active = await OfficialFormVersion.findOne({ formId: version.formId, status: 'active' }).lean();
    return res.json({
      version: publicVersion(version),
      mapping,
      diff: active ? compareInventory(active.fieldInventory, version.fieldInventory) : null,
    });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

router.get('/official-forms/:formId/versions/:versionId/fields', async (req, res) => {
  const version = await OfficialFormVersion.findOne({
    _id: req.params.versionId,
    formId: req.params.formId,
  }).select('fieldInventory');
  if (!version) return res.status(404).json({ error: 'Form version not found' });
  return res.json({ fields: version.fieldInventory });
});

router.get('/official-forms/:formId/versions/:versionId/pdf', async (req, res) => {
  const version = await OfficialFormVersion.findOne({
    _id: req.params.versionId,
    formId: req.params.formId,
  }).select('+pdfData');
  if (!version) return res.status(404).json({ error: 'Form version not found' });
  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': 'inline',
    'Cache-Control': 'no-store',
  });

  router.post('/official-forms/:formId/versions/:versionId/preview', async (req, res) => {
    try {
      const version = await OfficialFormVersion.findOne({
        _id: req.params.versionId,
        formId: req.params.formId,
        status: 'draft',
      }).select('+pdfData');
      if (!version) return res.status(404).json({ error: 'Draft form version not found' });
      const mapping = await OfficialFormMapping.findOne({ versionId: version._id });
      if (!mapping) return res.status(409).json({ error: 'A mapping is required before previewing' });
      if (!req.body?.planId) return res.status(400).json({ error: 'planId is required' });
      const Plan = require('../models/Plan');
      const plan = await Plan.findById(req.body.planId).lean();
      if (!plan) return res.status(404).json({ error: 'Sample plan not found' });
      const answers = toAnswerMap(plan.answers);
      for (const [section, value] of [
        ['parentingTimeAndCommunication', plan.parentingTimeAndCommunication],
        ['informationSharing', plan.informationSharing],
        ['taxExemptions', plan.taxExemptions],
      ]) {
        if (value && typeof value === 'object') {
          Object.entries(value).forEach(([key, answer]) => { answers[`${section}.${key}`] = answer; });
        }
      }
      const result = await fillOfficialForm(version, mapping, answers, { flatten: false });
      res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': 'inline' });
      return res.send(Buffer.from(result.bytes));
    } catch (error) {
      console.error('Could not generate official form preview:', error);
      return res.status(400).json({ error: error.message });
    }
  });
  return res.send(version.pdfData);
});

router.get('/official-forms/:formId/versions/:versionId/mapping/history', async (req, res) => {
  const mapping = await OfficialFormMapping.findOne({ versionId: req.params.versionId }).select('+revisionHistory');
  if (!mapping) return res.status(404).json({ error: 'Mapping not found' });
  return res.json({ history: mapping.revisionHistory });
});

router.put('/official-forms/:formId/versions/:versionId/mapping', async (req, res) => {
  try {
    const version = await OfficialFormVersion.findOne({
      _id: req.params.versionId,
      formId: req.params.formId,
    });
    if (!version) return res.status(404).json({ error: 'Form version not found' });
    if (version.status === 'archived') return res.status(409).json({ error: 'Archived mappings cannot be edited' });
    if (version.status === 'active') return res.status(409).json({ error: 'Create a draft version before editing an active mapping' });
    await validateMapping(version, req.body.fields);
    const mapping = await OfficialFormMapping.findOne({ versionId: version._id });
    const before = mapping ? snapshotMapping(mapping) : null;
    const savedMapping = await OfficialFormMapping.findOneAndUpdate(
      { versionId: version._id },
      { $set: { fields: req.body.fields, updatedBy: req.user.uid } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ).select('+revisionHistory');
    appendRevision(savedMapping, before, snapshotMapping(savedMapping), req.user.uid);
    await savedMapping.save();
    return res.json(savedMapping);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

router.post('/official-forms/:formId/versions/:versionId/publish', async (req, res) => {
  try {
    const version = await OfficialFormVersion.findOne({
      _id: req.params.versionId,
      formId: req.params.formId,
    }).select('+pdfData');
    if (!version) return res.status(404).json({ error: 'Form version not found' });
    const mapping = await OfficialFormMapping.findOne({ versionId: version._id });
    if (!mapping) return res.status(409).json({ error: 'A mapping is required before publishing' });
    await validateMapping(version, mapping.fields, { allowNeedsReview: false });
    const previous = await OfficialFormVersion.findOne({ formId: version.formId, status: 'active' });
    if (previous && String(previous._id) !== String(version._id)) {
      previous.status = 'archived';
      await previous.save();
    }
    version.status = 'active';
    await version.save();
    return res.json({ version: publicVersion(version) });
  } catch (error) {
    return res.status(409).json({ error: error.message });
  }
});

router.get('/official-forms/:formId/versions/:versionId/coverage', async (req, res) => {
  const version = await OfficialFormVersion.findOne({
    _id: req.params.versionId,
    formId: req.params.formId,
  }).lean();
  if (!version) return res.status(404).json({ error: 'Form version not found' });
  const mapping = await OfficialFormMapping.findOne({ versionId: version._id }).lean();
  const mapped = new Set((mapping?.fields || []).map((field) => field.pdfField).filter(Boolean));
  return res.json({
    fields: version.fieldInventory,
    unmappedFields: version.fieldInventory.filter((field) => !mapped.has(field.name)),
  });
});

router.post('/official-forms/:formId/versions/:versionId/archive', async (req, res) => {
  const version = await OfficialFormVersion.findOne({
    _id: req.params.versionId,
    formId: req.params.formId,
  });
  if (!version) return res.status(404).json({ error: 'Form version not found' });
  if (version.status === 'active') return res.status(409).json({ error: 'Publish another version before archiving the active version' });
  version.status = 'archived';
  await version.save();
  return res.json({ version: publicVersion(version) });
});

module.exports = router;
