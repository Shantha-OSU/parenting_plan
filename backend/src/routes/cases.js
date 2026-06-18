const express = require('express');
const router = express.Router();
const Case = require('../models/Case');
const Plan = require('../models/Plan');
const User = require('../models/User');
const QuestionnaireResponse = require('../models/QuestionnaireResponse');
const Resolution = require('../models/Resolution');
const ResolutionReview = require('../models/ResolutionReview');
const verifyToken = require('../middleware/verifyToken');
const { computeDiff } = require('../services/comparisonService');
const { getFirstName } = require('../utils/nameUtils');

// Helper: verify the requesting user is a member of the case
function isCaseMember(parentingCase, uid) {
  return parentingCase.parent1Uid === uid || parentingCase.parent2Uid === uid;
}

// Items P2 flagged that P1 did not address in the final pass remain as disagreements.
function countRemainingDisagreements(reviewDoc, finalAnswers) {
  const flagged = (reviewDoc?.reviews ?? []).filter(r => !r.accepted).map(r => r.qKey);
  return flagged.filter(qKey => finalAnswers[qKey] === undefined).length;
}

// GET /api/v1/cases/:caseId/status
router.get('/:caseId/status', verifyToken, async (req, res) => {
  try {
    const parentingCase = await Case.findById(req.params.caseId);
    if (!parentingCase) return res.status(404).json({ error: 'Case not found' });
    if (!isCaseMember(parentingCase, req.user.uid)) return res.status(403).json({ error: 'Forbidden' });

    res.status(200).json({
      caseId: parentingCase._id,
      status: parentingCase.status,
      isParent1: parentingCase.parent1Uid === req.user.uid,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/cases/:caseId/my-responses
router.get('/:caseId/my-responses', verifyToken, async (req, res) => {
  try {
    const parentingCase = await Case.findById(req.params.caseId);
    if (!parentingCase) return res.status(404).json({ error: 'Case not found' });
    if (!isCaseMember(parentingCase, req.user.uid)) return res.status(403).json({ error: 'Forbidden' });

    const response = await QuestionnaireResponse.findOne({
      caseId: req.params.caseId,
      parentUid: req.user.uid,
    });

    if (!response) {
      return res.status(200).json({ answers: {}, isComplete: false });
    }

    res.status(200).json(response);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/v1/cases/:caseId/my-responses
router.put('/:caseId/my-responses', verifyToken, async (req, res) => {
  try {
    const parentingCase = await Case.findById(req.params.caseId);
    if (!parentingCase) return res.status(404).json({ error: 'Case not found' });
    if (!isCaseMember(parentingCase, req.user.uid)) return res.status(403).json({ error: 'Forbidden' });

    // Lock answers after submission
    const existing = await QuestionnaireResponse.findOne({
      caseId: req.params.caseId,
      parentUid: req.user.uid,
    });
    if (existing?.isComplete) {
      return res.status(409).json({ error: 'Responses already submitted and cannot be changed' });
    }

    const updated = await QuestionnaireResponse.findOneAndUpdate(
      { caseId: req.params.caseId, parentUid: req.user.uid },
      { $set: { answers: req.body.answers } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.status(200).json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/cases/:caseId/my-responses/submit
router.post('/:caseId/my-responses/submit', verifyToken, async (req, res) => {
  try {
    const parentingCase = await Case.findById(req.params.caseId);
    if (!parentingCase) return res.status(404).json({ error: 'Case not found' });
    if (!isCaseMember(parentingCase, req.user.uid)) return res.status(403).json({ error: 'Forbidden' });

    const response = await QuestionnaireResponse.findOneAndUpdate(
      { caseId: req.params.caseId, parentUid: req.user.uid },
      { $set: { isComplete: true, submittedAt: new Date() } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Check if the other parent has also submitted — if so, mark case as comparison_ready
    const otherUid = parentingCase.parent1Uid === req.user.uid ? parentingCase.parent2Uid : parentingCase.parent1Uid;
    const otherResponse = await QuestionnaireResponse.findOne({
      caseId: req.params.caseId,
      parentUid: otherUid,
    });

    if (otherResponse?.isComplete) {
      parentingCase.status = 'comparison_ready';
      await parentingCase.save();
    }

    res.status(200).json({ message: 'Responses submitted', isComplete: response.isComplete, caseStatus: parentingCase.status });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/cases/:caseId/comparison
router.get('/:caseId/comparison', verifyToken, async (req, res) => {
  try {
    const parentingCase = await Case.findById(req.params.caseId);
    if (!parentingCase) return res.status(404).json({ error: 'Case not found' });
    if (!isCaseMember(parentingCase, req.user.uid)) return res.status(403).json({ error: 'Forbidden' });

    // Security gate: comparison is only available once both parents have submitted
    if (!['comparison_ready', 'resolved'].includes(parentingCase.status)) {
      return res.status(403).json({ error: 'Comparison not available yet — both parents must submit first' });
    }

    const [response1, response2] = await Promise.all([
      QuestionnaireResponse.findOne({ caseId: req.params.caseId, parentUid: parentingCase.parent1Uid }),
      QuestionnaireResponse.findOne({ caseId: req.params.caseId, parentUid: parentingCase.parent2Uid }),
    ]);

    const diff = computeDiff(response1?.answers, response2?.answers);

    res.status(200).json({ caseId: parentingCase._id, status: parentingCase.status, diff });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/cases/:caseId/plan-comparison
// Compares both parents' Plan.answers and returns a diff. Works even before both parents submit.
router.get('/:caseId/plan-comparison', verifyToken, async (req, res) => {
  try {
    const parentingCase = await Case.findById(req.params.caseId);
    if (!parentingCase) return res.status(404).json({ error: 'Case not found' });
    if (!isCaseMember(parentingCase, req.user.uid)) return res.status(403).json({ error: 'Forbidden' });

    if (!parentingCase.parent2Uid) {
      return res.status(200).json({ caseId: parentingCase._id, status: 'waiting_for_coparent', diff: [] });
    }

    const [plan1, plan2] = await Promise.all([
      Plan.findOne({ caseId: req.params.caseId, userID: parentingCase.parent1Uid }),
      Plan.findOne({ caseId: req.params.caseId, userID: parentingCase.parent2Uid }),
    ]);

    const toAnswerMap = (plan) => {
      if (!plan) return {};
      return plan.answers.reduce((acc, a) => { acc[a.qKey] = a.answer; return acc; }, {});
    };

    const diff = computeDiff(toAnswerMap(plan1), toAnswerMap(plan2));

    res.status(200).json({ caseId: parentingCase._id, status: parentingCase.status, diff });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/cases/:caseId/merge
// Saves the parents' resolved answer selections into mergedAnswers on the Case.
// Both parents can call this. mergedAnswers contains all qKeys — agreed ones auto-included,
// disagreed ones use whichever parent's answer was selected on the frontend.
router.post('/:caseId/merge', verifyToken, async (req, res) => {
  try {
    const parentingCase = await Case.findById(req.params.caseId);
    if (!parentingCase) return res.status(404).json({ error: 'Case not found' });

    // Only members of this case can save merged answers
    if (!isCaseMember(parentingCase, req.user.uid)) return res.status(403).json({ error: 'Forbidden' });

    // Convert the merged answer map into the Plan.answers array format: [{ qKey, answer }]
    const mergedAnswersArray = Object.entries(req.body.mergedAnswers || {})
      .filter(([, answer]) => answer != null)
      .map(([qKey, answer]) => ({ qKey, answer }));

    // Look up both parents' emails to use as descriptive plan names
    const [p1User, p2User] = await Promise.all([
      User.findOne({ firebaseUid: parentingCase.parent1Uid }, 'name email'),
      User.findOne({ firebaseUid: parentingCase.parent2Uid }, 'name email'),
    ]);
    const p1Name = getFirstName(p1User);
    const p2Name = getFirstName(p2User);
    const mergedPlanName = `${p1Name} & ${p2Name} - Merged Plan`;

    const p1Plan = await Plan.findById(parentingCase.parent1PlanId);
    const sharedChildren = p1Plan?.children ?? [];

    await Promise.all([
      Plan.create({ userID: parentingCase.parent1Uid, name: mergedPlanName, answers: mergedAnswersArray, children: sharedChildren, caseId: parentingCase._id, isShared: true }),
      Plan.create({ userID: parentingCase.parent2Uid, name: mergedPlanName, answers: mergedAnswersArray, children: sharedChildren, caseId: parentingCase._id, isShared: true }),
    ]);

    // Save the case as resolved only after both plans are successfully created
    parentingCase.mergedAnswers = req.body.mergedAnswers || {};
    parentingCase.status = 'resolved';
    await parentingCase.save();

    res.status(200).json({ message: 'Merged plan saved', status: parentingCase.status });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Resolution routes ────────────────────────────────────────────────────────

// POST /api/v1/cases/:caseId/resolutions
// Parent 1 submits proposed resolutions for each differing question.
router.post('/:caseId/resolutions', verifyToken, async (req, res) => {
  try {
    const parentingCase = await Case.findById(req.params.caseId);
    if (!parentingCase) return res.status(404).json({ error: 'Case not found' });
    if (parentingCase.parent1Uid !== req.user.uid) return res.status(403).json({ error: 'Only Parent 1 can submit resolutions' });
    if (!parentingCase.parent2Uid) return res.status(409).json({ error: 'Co-parent has not joined yet' });
    const preResolutionStatuses = ['pending_invite', 'both_complete', 'comparison_ready'];
    if (!preResolutionStatuses.includes(parentingCase.status)) return res.status(409).json({ error: `Cannot submit resolutions in status: ${parentingCase.status}` });

    const { resolutions } = req.body;
    if (!Array.isArray(resolutions) || resolutions.length === 0) {
      return res.status(400).json({ error: 'resolutions array is required' });
    }

    await Resolution.findOneAndUpdate(
      { caseId: parentingCase._id },
      { resolutions, submittedAt: new Date() },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    parentingCase.status = 'resolutions_pending';
    await parentingCase.save();

    res.status(200).json({ message: 'Resolutions submitted', status: parentingCase.status });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/cases/:caseId/resolutions
// Both parents fetch P1's submitted resolutions.
router.get('/:caseId/resolutions', verifyToken, async (req, res) => {
  try {
    const parentingCase = await Case.findById(req.params.caseId);
    if (!parentingCase) return res.status(404).json({ error: 'Case not found' });
    if (!isCaseMember(parentingCase, req.user.uid)) return res.status(403).json({ error: 'Forbidden' });

    const resolution = await Resolution.findOne({ caseId: parentingCase._id });
    if (!resolution) return res.status(404).json({ error: 'No resolutions submitted yet' });

    res.status(200).json(resolution);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/cases/:caseId/resolutions/review
// Parent 2 submits accept/flag feedback on P1's proposed resolutions.
router.post('/:caseId/resolutions/review', verifyToken, async (req, res) => {
  try {
    const parentingCase = await Case.findById(req.params.caseId);
    if (!parentingCase) return res.status(404).json({ error: 'Case not found' });
    if (parentingCase.parent2Uid !== req.user.uid) return res.status(403).json({ error: 'Only Parent 2 can submit a review' });
    if (parentingCase.status !== 'resolutions_pending') return res.status(409).json({ error: `Cannot submit review in status: ${parentingCase.status}` });

    const { reviews } = req.body;
    if (!Array.isArray(reviews) || reviews.length === 0) {
      return res.status(400).json({ error: 'reviews array is required' });
    }

    await ResolutionReview.findOneAndUpdate(
      { caseId: parentingCase._id },
      { reviews, submittedAt: new Date() },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    parentingCase.status = 'resolutions_reviewed';
    await parentingCase.save();

    res.status(200).json({ message: 'Review submitted', status: parentingCase.status });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/cases/:caseId/resolutions/review
// Both parents fetch P2's review feedback.
router.get('/:caseId/resolutions/review', verifyToken, async (req, res) => {
  try {
    const parentingCase = await Case.findById(req.params.caseId);
    if (!parentingCase) return res.status(404).json({ error: 'Case not found' });
    if (!isCaseMember(parentingCase, req.user.uid)) return res.status(403).json({ error: 'Forbidden' });

    const review = await ResolutionReview.findOne({ caseId: parentingCase._id });
    if (!review) return res.status(404).json({ error: 'No review submitted yet' });

    res.status(200).json(review);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/cases/:caseId/resolutions/final
// Parent 1 submits final answers for items P2 flagged.
// If no remaining disagreements after this pass → resolved; otherwise → needs_discussion.
router.post('/:caseId/resolutions/final', verifyToken, async (req, res) => {
  try {
    const parentingCase = await Case.findById(req.params.caseId);
    if (!parentingCase) return res.status(404).json({ error: 'Case not found' });
    if (parentingCase.parent1Uid !== req.user.uid) return res.status(403).json({ error: 'Only Parent 1 can submit final answers' });
    if (parentingCase.status !== 'resolutions_reviewed') return res.status(409).json({ error: `Cannot submit final answers in status: ${parentingCase.status}` });

    const { finalAnswers } = req.body; // { [qKey]: answer }
    if (!finalAnswers || typeof finalAnswers !== 'object') {
      return res.status(400).json({ error: 'finalAnswers object is required' });
    }

    // Apply final answers using the positional $ operator — one update per changed key.
    // This is clearer than building dynamic arrayFilters for an arbitrary number of keys.
    const changedKeys = Object.keys(finalAnswers);
    if (changedKeys.length > 0) {
      for (const [qKey, answer] of Object.entries(finalAnswers)) {
        await Resolution.findOneAndUpdate(
          { caseId: parentingCase._id, 'resolutions.qKey': qKey },
          { $set: { 'resolutions.$.proposedAnswer': answer, 'resolutions.$.source': 'custom' } }
        );
      }
      await Resolution.findOneAndUpdate(
        { caseId: parentingCase._id },
        { $set: { submittedAt: new Date() } }
      );
    }

    const resolution = await Resolution.findOne({ caseId: parentingCase._id });
    if (!resolution) return res.status(404).json({ error: 'No resolutions found for this case' });

    const review = await ResolutionReview.findOne({ caseId: parentingCase._id });
    const remainingCount = countRemainingDisagreements(review, finalAnswers);

    parentingCase.status = remainingCount === 0 ? 'resolved' : 'needs_discussion';
    await parentingCase.save();

    res.status(200).json({ message: 'Final answers submitted', status: parentingCase.status });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
