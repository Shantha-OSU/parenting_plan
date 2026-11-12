#!/usr/bin/env node
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const fs = require('fs/promises');
const path = require('path');
const mongoose = require('mongoose');
const OfficialFormVersion = require('../src/models/OfficialFormVersion');
const OfficialFormMapping = require('../src/models/OfficialFormMapping');
const { inspectPdfFields, sha256 } = require('../src/services/officialFormService');
const { connectDB } = require('../src/config/database');

const assets = [
  { formId: 'oh-dr-form-20', file: 'form-20.pdf', revisionLabel: 'Amended 2021-06-01' },
  { formId: 'oh-dr-form-21', file: 'form-21.pdf', revisionLabel: 'Amended 2024-06-24' },
];

async function main() {
  await connectDB();
  for (const asset of assets) {
    const filePath = path.resolve(__dirname, '../assets/official-forms', asset.file);
    const bytes = await fs.readFile(filePath);
    const inspected = await inspectPdfFields(bytes);
    const version = await OfficialFormVersion.findOneAndUpdate(
      { formId: asset.formId, pdfSha256: sha256(bytes) },
      {
        $setOnInsert: {
          formId: asset.formId,
          revisionLabel: asset.revisionLabel,
          pdfSha256: sha256(bytes),
          pdfData: bytes,
          fieldInventory: inspected.fields,
          isFillable: inspected.isFillable,
          status: 'active',
          uploadedBy: 'seed-script',
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    await OfficialFormMapping.updateOne(
      { versionId: version._id },
      { $setOnInsert: { versionId: version._id, fields: [], updatedBy: 'seed-script' } },
      { upsert: true },
    );
    await OfficialFormVersion.updateMany(
      { formId: asset.formId, _id: { $ne: version._id }, status: 'active' },
      { $set: { status: 'archived' } },
    );
    console.log(`${asset.formId}: ${version._id} (${inspected.fields.length} fields)`);
  }
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error.message);
  await mongoose.disconnect();
  process.exitCode = 1;
});
