const mongoose = require('mongoose');

const revisionSchema = new mongoose.Schema({
  actorUid: { type: String, required: true },
  changedAt: { type: Date, required: true },
  before: { type: mongoose.Schema.Types.Mixed, default: null },
  after: { type: mongoose.Schema.Types.Mixed, required: true },
}, { _id: false });

const mappingFieldSchema = new mongoose.Schema({
  pdfField: {
    type: String,
    default: null,
  },
  overlay: {
    page: Number,
    x: Number,
    y: Number,
    size: Number,
  },
  type: { type: String, enum: ['text', 'checkbox', 'radio', 'dropdown'], required: true },
  rule: { type: mongoose.Schema.Types.Mixed, required: true },
  reviewStatus: { type: String, enum: ['ok', 'needs_review'], default: 'needs_review' },
}, { _id: false });

const officialFormMappingSchema = new mongoose.Schema({
  versionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'OfficialFormVersion',
    required: true,
    unique: true,
    index: true,
  },
  fields: { type: [mappingFieldSchema], default: [] },
  revisionHistory: { type: [revisionSchema], default: [], select: false },
  updatedBy: { type: String, required: true },
}, { timestamps: true, optimisticConcurrency: true });

module.exports = mongoose.model('OfficialFormMapping', officialFormMappingSchema);
