const mongoose = require('mongoose');

const fieldInventorySchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, enum: ['text', 'checkbox', 'radio', 'dropdown', 'unknown'], required: true },
  page: { type: Number, required: true },
  rect: {
    x: Number,
    y: Number,
    width: Number,
    height: Number,
  },
  options: { type: [String], default: [] },
}, { _id: false });

const officialFormVersionSchema = new mongoose.Schema({
  formId: {
    type: String,
    enum: ['oh-dr-form-20', 'oh-dr-form-21'],
    required: true,
  },
  revisionLabel: { type: String, required: true, trim: true, maxlength: 120 },
  pdfSha256: { type: String, required: true, index: true },
  pdfData: { type: Buffer, required: true, select: false },
  fieldInventory: { type: [fieldInventorySchema], default: [] },
  isFillable: { type: Boolean, required: true, default: false },
  status: { type: String, enum: ['draft', 'active', 'archived'], default: 'draft', index: true },
  uploadedBy: { type: String, required: true },
}, { timestamps: true });

officialFormVersionSchema.index({ formId: 1, status: 1 });
officialFormVersionSchema.index({ formId: 1, pdfSha256: 1 }, { unique: true });
officialFormVersionSchema.index(
  { formId: 1 },
  { unique: true, partialFilterExpression: { status: 'active' } },
);

module.exports = mongoose.model('OfficialFormVersion', officialFormVersionSchema);
