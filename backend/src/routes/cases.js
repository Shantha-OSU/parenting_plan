const express = require('express');
const router = express.Router();
const Case = require('../models/Case');
const Plan = require('../models/Plan');
const Question = require('../models/Question');
const User = require('../models/User');
const QuestionnaireResponse = require('../models/QuestionnaireResponse');
const Resolution = require('../models/Resolution');
const ResolutionReview = require('../models/ResolutionReview');
const verifyToken = require('../middleware/verifyToken');
const { computeDiff, filterExcludedAnswers, normalizeAnswer } = require('../services/comparisonService');
const { getFirstName } = require('../utils/nameUtils');

const COMPARABLE_SECTION_FIELDS = {
  parentingTimeAndCommunication: [
    'parentingSchedule',
    'holidaySchedule',
    'schoolSchedule',
    'agreeToTransportationPolicy',
    'transportationArrangementDescription',
    'agreeToActivityPolicy',
    'activityPolicyDescription',
    'communicationWithCoParentOnPhone',
    'communicationWithCoParentOnPhoneDescription',
    'notifyCoParentOfChildRelatedEvents',
    'notifyCoParentOfChildRelatedEventsDescription',
  ],
  informationSharing: [
    'medicalRecords',
    'schoolContact',
    'schoolActivities',
  ],
  taxExemptions: [
    'parentRole',
    'childAnswers',
  ],
};

async function getExcludedComparisonQuestionKeys() {
  const excludedKeys = await Question.find({ includeInComparison: false }).distinct('qKey');
  return new Set(excludedKeys);
}

async function getComparisonConflictValues() {
  const questions = await Question.find({}, 'qKey comparisonConflictValues');
  return questions.reduce((valuesByQuestion, question) => {
    if (Array.isArray(question.comparisonConflictValues)) {
      valuesByQuestion[question.qKey] = question.comparisonConflictValues;
    }
    return valuesByQuestion;
  }, {});
}

// Helper: verify the requesting user is a member of the case
function isCaseMember(parentingCase, uid) {
  return parentingCase.parent1Uid === uid || parentingCase.parent2Uid === uid;
}

function toPlanAnswerMap(plan, parentRole) {
  if (!plan) return {};

  const answers = {};
  plan.answers?.forEach(({ qKey, answer }) => {
    answers[qKey] = parentRole ? normalizeAnswer(answer, parentRole) : answer;
  });

  for (const [section, fields] of Object.entries(COMPARABLE_SECTION_FIELDS)) {
    for (const field of fields) {
      const answer = plan[section]?.[field];
      if (answer !== undefined && answer !== null && answer !== '') {
        answers[`${section}.${field}`] = parentRole ? normalizeAnswer(answer, parentRole) : answer;
      }
    }
  }

  return answers;
}

function toMergedAnswerEntries(answerMap) {
  if (Array.isArray(answerMap)) return answerMap;
  if (answerMap instanceof Map) return [...answerMap].map(([qKey, answer]) => ({ qKey, answer }));
  return Object.entries(answerMap || {}).map(([qKey, answer]) => ({ qKey, answer }));
}

function fromMergedAnswerEntries(mergedAnswers) {
  if (Array.isArray(mergedAnswers)) {
    return Object.fromEntries(mergedAnswers.map(({ qKey, answer }) => [qKey, answer]));
  }
  if (mergedAnswers instanceof Map) return Object.fromEntries(mergedAnswers);
  return mergedAnswers || {};
}

// GET /api/v1/cases/:caseId/status
router.get('/:caseId/status', verifyToken, async (req, res) => {
  try {
    const parentingCase = await Case.findById(req.params.caseId);
    if (!parentingCase) return res.status(404).json({ error: 'Case not found' });
    if (!isCaseMember(parentingCase, req.user.uid)) return res.status(403).json({ error: 'Forbidden' });

    // Gets parents names for comparison tool understanding
    const [plan1, plan2, parent1, parent2] = await Promise.all([
      parentingCase.parent1PlanId ? Plan.findById(parentingCase.parent1PlanId, 'parentFName parentLName streetAddress city state zipCode children userRole') : null,
      parentingCase.parent2PlanId ? Plan.findById(parentingCase.parent2PlanId, 'parentFName parentLName streetAddress city state zipCode children userRole') : null,
      User.findOne({ firebaseUid: parentingCase.parent1Uid }, 'name email'),
      parentingCase.parent2Uid
        ? User.findOne({ firebaseUid: parentingCase.parent2Uid }, 'name email')
        : null,
    ]);
    const displayName = (storedName, plan, user, fallback) =>
      [plan?.parentFName, plan?.parentLName].filter(Boolean).join(' ').trim()
      || storedName?.trim()
      || getFirstName(user).trim()
      || fallback;

    res.status(200).json({
      caseId: parentingCase._id,
      status: parentingCase.status,
      isParent1: parentingCase.parent1Uid === req.user.uid,
      userRole: parentingCase.parent1Uid === req.user.uid ? plan1?.userRole : plan2?.userRole,
      parent1Name: displayName(parentingCase.parent1Name, plan1, parent1, 'Parent 1'),
      parent2Name: parentingCase.parent2Uid
        ? displayName(parentingCase.parent2Name, plan2, parent2, 'Co-parent')
        : 'Co-parent',
      parent1Address: parentingCase.parent1Address || plan1?.streetAddress || '',
      parent1City: parentingCase.parent1City || plan1?.city || '',
      parent1State: parentingCase.parent1State || plan1?.state || '',
      parent1ZipCode: parentingCase.parent1ZipCode || plan1?.zipCode || '',
      parent2Address: parentingCase.parent2Address || plan2?.streetAddress || '',
      parent2City: parentingCase.parent2City || plan2?.city || '',
      parent2State: parentingCase.parent2State || plan2?.state || '',
      parent2ZipCode: parentingCase.parent2ZipCode || plan2?.zipCode || '',
      children: plan1?.children?.length ? plan1.children : (plan2?.children || []),
      sharedAnswers: fromMergedAnswerEntries(parentingCase.mergedAnswers),
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
    if (!['comparison_ready', 'resolutions_reviewed', 'needs_discussion', 'resolved'].includes(parentingCase.status)) {
      return res.status(403).json({ error: 'Comparison not available yet — both parents must submit first' });
    }

    const [response1, response2] = await Promise.all([
      QuestionnaireResponse.findOne({ caseId: req.params.caseId, parentUid: parentingCase.parent1Uid }),
      QuestionnaireResponse.findOne({ caseId: req.params.caseId, parentUid: parentingCase.parent2Uid }),
    ]);

    const [excludedQuestionKeys, conflictValuesByQuestion] = await Promise.all([
      getExcludedComparisonQuestionKeys(),
      getComparisonConflictValues(),
    ]);
    const diff = computeDiff(
      filterExcludedAnswers(response1?.answers, excludedQuestionKeys),
      filterExcludedAnswers(response2?.answers, excludedQuestionKeys),
      conflictValuesByQuestion
    );

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

    const [excludedQuestionKeys, conflictValuesByQuestion] = await Promise.all([
      getExcludedComparisonQuestionKeys(),
      getComparisonConflictValues(),
    ]);
    const diff = computeDiff(
      filterExcludedAnswers(toPlanAnswerMap(plan1, 'parent1'), excludedQuestionKeys),
      filterExcludedAnswers(toPlanAnswerMap(plan2, 'parent2'), excludedQuestionKeys),
      conflictValuesByQuestion
    );

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

    // Keep the merged answers on the shared case. Individual plans are unchanged.
    parentingCase.mergedAnswers = toMergedAnswerEntries(req.body.mergedAnswers);
    parentingCase.status = 'resolved';
    await parentingCase.save();

    res.status(200).json({ message: 'Merged plan saved', status: parentingCase.status });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/cases/:caseId/restart-comparison
// Clears only the shared case result so the comparison can be run again.
// The parents' individual plans are intentionally left unchanged.
router.post('/:caseId/restart-comparison', verifyToken, async (req, res) => {
  try {
    const parentingCase = await Case.findById(req.params.caseId);
    if (!parentingCase) return res.status(404).json({ error: 'Case not found' });
    if (!isCaseMember(parentingCase, req.user.uid)) return res.status(403).json({ error: 'Forbidden' });
    if (!['resolved', 'needs_discussion'].includes(parentingCase.status)) {
      return res.status(409).json({ error: `Cannot restart comparison in status: ${parentingCase.status}` });
    }

    parentingCase.mergedAnswers = [];
    parentingCase.status = 'pending_invite';
    await parentingCase.save();
    await Promise.all([
      Resolution.deleteOne({ caseId: parentingCase._id }),
      ResolutionReview.deleteOne({ caseId: parentingCase._id }),
    ]);

    res.status(200).json({ caseId: parentingCase._id, status: parentingCase.status });
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

    const normalizedResolutions = resolutions.map((resolution) => ({
      ...resolution,
      proposedAnswer: resolution.source === 'parent1' || resolution.source === 'parent2'
        ? normalizeAnswer(resolution.proposedAnswer, resolution.source)
        : resolution.proposedAnswer,
    }));

    await Resolution.findOneAndUpdate(
      { caseId: parentingCase._id },
      { resolutions: normalizedResolutions, submittedAt: new Date() },
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

    const [sourcePlan, resolution] = await Promise.all([
      Plan.findById(parentingCase.parent1PlanId),
      Resolution.findOne({ caseId: parentingCase._id }),
    ]);
    const mergedAnswers = toPlanAnswerMap(sourcePlan, 'parent1');
    resolution?.resolutions?.forEach(({ qKey, proposedAnswer, source }) => {
      mergedAnswers[qKey] = source === 'parent1' || source === 'parent2'
        ? normalizeAnswer(proposedAnswer, source)
        : proposedAnswer;
    });
    parentingCase.mergedAnswers = toMergedAnswerEntries(mergedAnswers);

    const hasFlaggedItems = reviews.some((review) => !review.accepted);
    parentingCase.status = hasFlaggedItems ? 'needs_discussion' : 'resolved';
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

    // Apply final answers using arrayFilters so we only touch changed items
    // and never re-validate untouched subdocuments.
    const changedKeys = Object.keys(finalAnswers);
    if (changedKeys.length > 0) {
      const updateOps = { submittedAt: new Date() };
      const arrayFilters = changedKeys.map((qKey, i) => ({ [`elem${i}.qKey`]: qKey }));
      changedKeys.forEach((qKey, i) => {
        updateOps[`resolutions.$[elem${i}].proposedAnswer`] = finalAnswers[qKey];
        updateOps[`resolutions.$[elem${i}].source`] = 'custom';
      });
      await Resolution.findOneAndUpdate(
        { caseId: parentingCase._id },
        { $set: updateOps },
        { arrayFilters, new: true }
      );
    }

    const resolution = await Resolution.findOne({ caseId: parentingCase._id });
    if (!resolution) return res.status(404).json({ error: 'No resolutions found for this case' });

    // Determine remaining disagreements from P2's review.
    // Items P2 flagged AND P1 did not change in this final pass are still in disagreement.
    const review = await ResolutionReview.findOne({ caseId: parentingCase._id });
    const flaggedKeys = new Set((review?.reviews ?? []).filter((r) => !r.accepted).map((r) => r.qKey));

    // If P1 submitted a new answer for a flagged key, consider it addressed.
    const remainingCount = [...flaggedKeys].filter((qKey) => finalAnswers[qKey] === undefined).length;

    parentingCase.status = remainingCount === 0 ? 'resolved' : 'needs_discussion';

    if (remainingCount === 0) {
      const sourcePlan = await Plan.findById(parentingCase.parent1PlanId);
      const mergedAnswers = toPlanAnswerMap(sourcePlan, 'parent1');

      resolution.resolutions.forEach(({ qKey, proposedAnswer, source }) => {
        mergedAnswers[qKey] = source === 'parent1' || source === 'parent2'
          ? normalizeAnswer(proposedAnswer, source)
          : proposedAnswer;
      });

      parentingCase.mergedAnswers = toMergedAnswerEntries(mergedAnswers);
    }

    await parentingCase.save();

    res.status(200).json({ message: 'Final answers submitted', status: parentingCase.status });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
