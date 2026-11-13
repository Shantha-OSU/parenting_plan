const mongoose = require('mongoose');

/*
 * Stores Parent 1's proposed resolutions for each differing question in a case.
 * Created when P1 calls POST /api/v1/cases/:caseId/resolutions.
 * One document per case, upserted on re-submission.
 */
const resolutionItemSchema = new mongoose.Schema({
  qKey: { type: String, required: true },
  proposedAnswer: { type: mongoose.Schema.Types.Mixed },
  // 'parent1' = kept own answer, 'parent2' = adopted co-parent's, 'custom' = free-text
  source: { type: String, enum: ['parent1', 'parent2', 'custom'], required: true },
  flaggedForDiscussion: { type: Boolean, default: false },
}, { _id: false });

const resolutionSchema = new mongoose.Schema(
  {
    caseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Case', required: true, unique: true },
    resolutions: [resolutionItemSchema],
    submittedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Resolution', resolutionSchema);
