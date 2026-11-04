const mongoose = require('mongoose');

const blockSchema = new mongoose.Schema({
  id: { type: String, required: true },
  type: { type: String, enum: ['heading', 'text', 'answer'], required: true },
  qKey: { type: String },
  questionText: { type: String },
  infoText: { type: String, default: '' },
  text: { type: String },
}, { _id: false });

const standardFormTemplateSchema = new mongoose.Schema({
  format: {
    type: String,
    enum: ['review', 'comparison'],
    required: true,
    unique: true,
  },
  title: { type: String, required: true },
  layout: { type: String, default: 'blank' },
  blocks: { type: [blockSchema], required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

module.exports = mongoose.model('StandardFormTemplate', standardFormTemplateSchema);
