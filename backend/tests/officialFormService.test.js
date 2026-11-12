const test = require('node:test');
const assert = require('node:assert/strict');
const { PDFDocument } = require('pdf-lib');
const {
  inspectPdfFields,
  fillOfficialForm,
  resolveAnswer,
  compareInventory,
} = require('../src/services/officialFormService');

test('inspects and fills AcroForm fields from declarative mappings', async () => {
  const source = await PDFDocument.create();
  const page = source.addPage();
  const form = source.getForm();
  const name = form.createTextField('parent.name');
  name.addToPage(page, { x: 50, y: 700, width: 200, height: 20 });
  const consent = form.createCheckBox('parent.consent');
  consent.addToPage(page, { x: 50, y: 650, width: 12, height: 12 });
  const bytes = await source.save();
  const inspected = await inspectPdfFields(bytes);
  assert.equal(inspected.isFillable, true);
  assert.deepEqual(inspected.fields.map(({ name: fieldName, type }) => [fieldName, type]), [
    ['parent.name', 'text'],
    ['parent.consent', 'checkbox'],
  ]);

  const result = await fillOfficialForm({
    pdfData: Buffer.from(bytes),
    fieldInventory: inspected.fields,
    isFillable: true,
  }, {
    fields: [
      { pdfField: 'parent.name', type: 'text', reviewStatus: 'ok',
        rule: { type: 'direct', source: 'answer', qKey: 'parentFName' } },
      { pdfField: 'parent.consent', type: 'checkbox', reviewStatus: 'ok',
        rule: { type: 'valueMap', source: 'answer', qKey: 'courtCustodyOrderIssued', values: { yes: true } } },
    ],
  }, { parentFName: 'Alex', courtCustodyOrderIssued: 'yes' }, { flatten: false });

  const filled = await PDFDocument.load(result.bytes);
  assert.equal(filled.getForm().getTextField('parent.name').getText(), 'Alex');
  assert.equal(filled.getForm().getCheckBox('parent.consent').isChecked(), true);
});

test('marks non-final values for attention without writing them', () => {
  assert.deepEqual(resolveAnswer({ choice: 'needMoreInfo' }, {
    type: 'direct', source: 'answer', qKey: 'choice',
  }), { value: undefined, needsAttention: true });
});

test('reports field inventory changes', () => {
  assert.deepEqual(compareInventory(
    [{ name: 'a', type: 'text', options: [] }, { name: 'b', type: 'checkbox', options: [] }],
    [{ name: 'a', type: 'dropdown', options: ['yes'] }, { name: 'c', type: 'text', options: [] }],
  ), {
    added: ['c'],
    removed: ['b'],
    typeChanged: ['a'],
    optionChanged: ['a'],
  });
});
