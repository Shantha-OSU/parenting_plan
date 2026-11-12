#!/usr/bin/env node
const fs = require('fs/promises');
const path = require('path');
const { inspectPdfFields } = require('../src/services/officialFormService');

async function main() {
  const files = process.argv.slice(2);
  if (files.length === 0) {
    console.error('Usage: node scripts/inspect-pdf-fields.js <pdf> [pdf...]');
    process.exitCode = 1;
    return;
  }
  for (const file of files) {
    const result = await inspectPdfFields(await fs.readFile(path.resolve(file)));
    console.log(JSON.stringify({ file, ...result }, null, 2));
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
