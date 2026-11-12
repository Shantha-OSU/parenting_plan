const express = require('express');
const mongoose = require('mongoose');
const Question = require('../models/Question');
const NextQuestionRule = require('../models/NextQuestionRule');
const verifyToken = require('../middleware/verifyToken');
const requireAdmin = require('../middleware/requireAdmin');
const officialFormsAdminRoutes = require('./officialFormsAdmin');

const router = express.Router();
const editableQuestionFields = [
  'type',
  'qTitle',
  'qIntro',
  'qDisclaimer',
  'qIcon',
  'qText',
  'section',
  'options',
  'appliesToGroup',
];
const createQuestionFields = ['qKey', ...editableQuestionFields];
const ruleFields = ['isDefault', 'goToDefault', 'nextQuestions', 'notApplicableGoTo'];
const maximumHistoryEntries = 50;
const questionnaireStartKey = 'allocation_parental_rights';
const questionnaireSectionOrder = [
  'getting-started',
  'parental-rights',
  'parenting-time-communication',
  'health-insurance-coverage',
  'custody-schedule',
  'transportation',
  'tax-exemptions',
  'review'
];
const adminQuestionTypes = new Set(['multiple choice', 'text input']);

router.use(verifyToken.withRevocationCheck(), requireAdmin);
router.use(officialFormsAdminRoutes);

function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function containsOnlyFields(value, allowedFields) {
  return Object.keys(value).every((field) => allowedFields.includes(field));
}

function questionSnapshot(question) {
  const snapshot = { qKey: question.qKey };
  for (const field of editableQuestionFields) {
    snapshot[field] = field === 'options'
      ? question.options.map(({ value, label, description }) => ({ value, label, description }))
      : question[field];
  }
  snapshot.appliesToGroup = question.appliesToGroup || '';
  snapshot.isArchived = question.isArchived === true;
  return snapshot;
}

function validateQuestionPayload(payload, allowedFields, { requireAll = false } = {}) {
  const optionalFields = ['appliesToGroup'];
  if (!isPlainObject(payload) ||
      (requireAll && allowedFields.some((field) =>
        !optionalFields.includes(field) && !Object.hasOwn(payload, field)
      )) ||
      Object.keys(payload).length === 0 ||
      !containsOnlyFields(payload, allowedFields)) {
    return 'Provide valid question fields';
  }

  if (Object.hasOwn(payload, 'qKey') &&
      (typeof payload.qKey !== 'string' ||
       !/^[a-z][a-z0-9_]{1,99}$/.test(payload.qKey))) {
    return 'Question key must use lowercase letters, numbers, and underscores';
  }

  const textFields = ['type', 'qTitle', 'qIntro', 'qDisclaimer', 'qIcon', 'qText', 'section'];
  if (textFields.some((field) =>
    Object.hasOwn(payload, field) && typeof payload[field] !== 'string'
  )) {
    return 'Question fields must be strings';
  }
  if (Object.hasOwn(payload, 'type') && !adminQuestionTypes.has(payload.type)) {
    return 'Only multiple choice and text input questions are currently supported';
  }
  if (
    Object.hasOwn(payload, 'appliesToGroup') &&
    !['', 'married', 'not_married'].includes(payload.appliesToGroup)
  ) {
    return 'Question applicability must be married, not_married, or empty';
  }

  if (Object.hasOwn(payload, 'options')) {
    const { options } = payload;
    if (!Array.isArray(options) || options.length > 100 ||
        options.some((option) =>
          !isPlainObject(option) ||
          !containsOnlyFields(option, ['value', 'label', 'description']) ||
          ['value', 'label', 'description'].some((field) =>
            Object.hasOwn(option, field) && typeof option[field] !== 'string'
          )
        )) {
      return 'Question options are invalid';
    }
  }

  return null;
}

function ruleSnapshot(rule) {
  return {
    isDefault: rule.isDefault,
    goToDefault: rule.goToDefault,
    notApplicableGoTo: rule.notApplicableGoTo || '',
    nextQuestions: rule.nextQuestions.map(({ operator, value, goTo }) => ({
      operator,
      value,
      goTo
    }))
  };
}

function appendRevision(document, before, after, actorUid) {
  document.revisionHistory.push({
    actorUid,
    changedAt: new Date(),
    before,
    after
  });

  if (document.revisionHistory.length > maximumHistoryEntries) {
    document.revisionHistory.splice(0, document.revisionHistory.length - maximumHistoryEntries);
  }
}

function orderQuestionsByFlow(questions, rules) {
  const questionsByKey = new Map(questions.map((question) => [question.qKey, question]));
  const rulesByKey = new Map(rules.map((rule) => [rule.qKey, rule]));
  const orderedQuestions = [];
  const visitedKeys = new Set();

  function visitQuestion(qKey) {
    const question = questionsByKey.get(qKey);
    if (!question || question.isArchived === true || visitedKeys.has(qKey)) return;

    visitedKeys.add(qKey);
    orderedQuestions.push(question);

    const rule = rulesByKey.get(qKey);
    if (!rule) return;

    const destinations = rule.isDefault
      ? [rule.goToDefault, rule.notApplicableGoTo]
      : [...(rule.nextQuestions || []).map((nextRule) => nextRule.goTo), rule.notApplicableGoTo];
    destinations.forEach(visitQuestion);
  }

  visitQuestion(questionnaireStartKey);

  const sectionIndexes = new Map(questionnaireSectionOrder.map((section, index) => [section, index]));
  const unvisitedQuestions = questions
    .filter((question) => !visitedKeys.has(question.qKey))
    .sort((left, right) => {
      const leftArchived = left.isArchived === true;
      const rightArchived = right.isArchived === true;
      if (leftArchived !== rightArchived) {
        return leftArchived ? 1 : -1;
      }

      const sectionDifference =
        (sectionIndexes.get(left.section) ?? Number.MAX_SAFE_INTEGER) -
        (sectionIndexes.get(right.section) ?? Number.MAX_SAFE_INTEGER);
      if (sectionDifference !== 0) return sectionDifference;

      const createdDifference = new Date(left.createdAt || 0) - new Date(right.createdAt || 0);
      if (createdDifference !== 0) return createdDifference;
      return left.qKey.localeCompare(right.qKey);
    });

  unvisitedQuestions.forEach((question) => visitQuestion(question.qKey));
  questions
    .filter((question) => question.isArchived === true && !visitedKeys.has(question.qKey))
    .sort((left, right) => {
      const sectionDifference =
        (sectionIndexes.get(left.section) ?? Number.MAX_SAFE_INTEGER) -
        (sectionIndexes.get(right.section) ?? Number.MAX_SAFE_INTEGER);
      if (sectionDifference !== 0) return sectionDifference;
      return left.qKey.localeCompare(right.qKey);
    })
    .forEach((question) => orderedQuestions.push(question));
  return orderedQuestions;
}

// GET /api/admin/access
router.get('/access', (req, res) => {
  res.json({ isAdmin: true });
});

// GET /api/admin/questions
router.get('/questions', async (req, res) => {
  try {
    const [allQuestions, rules] = await Promise.all([
      Question.find()
        .select('type qTitle qIntro qDisclaimer qIcon qText qKey section options appliesToGroup createdAt isArchived')
        .lean(),
      NextQuestionRule.find()
        .select('qKey isDefault goToDefault notApplicableGoTo nextQuestions')
        .lean()
    ]);
    const orderedQuestions = orderQuestionsByFlow(allQuestions, rules);
    return res.json({
      questions: orderedQuestions,
      total: orderedQuestions.length,
      orderDescription: 'Active questions follow the branching flow from allocation_parental_rights. Unconnected active questions follow by section; archived questions are listed last.'
    });
  } catch (error) {
    console.error('Could not load questions for administrator:', error);
    return res.status(500).json({ error: 'Could not load questions' });
  }
});

// POST /api/admin/questions
router.post('/questions', async (req, res) => {
  const validationError = validateQuestionPayload(req.body, createQuestionFields, {
    requireAll: true
  });
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  try {
    const question = new Question(req.body);
    appendRevision(question, null, questionSnapshot(question), req.user.uid);
    await question.save();
    return res.status(201).json({ question: questionSnapshot(question) });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ error: 'A question with that key already exists' });
    }
    if (error.name === 'ValidationError' || error.name === 'CastError') {
      return res.status(400).json({ error: 'Question fields are invalid' });
    }

    console.error('Could not create question:', error);
    return res.status(500).json({ error: 'Could not create question' });
  }
});

// POST /api/admin/questions/:qKey/after
router.post('/questions/:qKey/after', async (req, res) => {
  const validationError = validateQuestionPayload(req.body, createQuestionFields, {
    requireAll: true
  });
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  let session;
  try {
    session = await mongoose.startSession();
    let createdQuestion;
    let previousSuccessor = '';

    await session.withTransaction(async () => {
      const previousQuestion = await Question.findOne({
        qKey: req.params.qKey,
        isArchived: { $ne: true }
      }).session(session);
      if (!previousQuestion) {
        const error = new Error('The question to insert after was not found or is archived');
        error.statusCode = 404;
        throw error;
      }

      const previousRule = await NextQuestionRule.findOne({ qKey: previousQuestion.qKey })
        .select('+revisionHistory')
        .session(session);
      if (previousRule) {
        const destinations = (previousRule.isDefault
          ? [previousRule.goToDefault || '', previousRule.notApplicableGoTo || '']
          : [
            ...previousRule.nextQuestions.map((nextQuestion) => nextQuestion.goTo),
            previousRule.notApplicableGoTo || ''
          ]).filter(Boolean);
        const uniqueDestinations = new Set(destinations);
        if (uniqueDestinations.size > 1) {
          const error = new Error(
            'This question has different branch destinations. Add after a question within one branch instead.'
          );
          error.statusCode = 409;
          throw error;
        }
        previousSuccessor = destinations[0] || '';
        if (previousSuccessor) {
          const successorExists = await Question.exists({
            qKey: previousSuccessor,
            isArchived: { $ne: true }
          }).session(session);
          if (!successorExists) {
            const error = new Error('The existing next question is unavailable');
            error.statusCode = 409;
            throw error;
          }
        }
      }

      const questionBefore = new Question(req.body);
      const questionAfter = questionSnapshot(questionBefore);
      appendRevision(questionBefore, null, questionAfter, req.user.uid);
      await questionBefore.save({ session });
      createdQuestion = questionSnapshot(questionBefore);

      if (previousRule) {
        const before = ruleSnapshot(previousRule);
        if (previousRule.isDefault) {
          previousRule.goToDefault = questionBefore.qKey;
        } else {
          previousRule.nextQuestions.forEach((nextQuestion) => {
            nextQuestion.goTo = questionBefore.qKey;
          });
        }
        if (previousRule.notApplicableGoTo === previousSuccessor) {
          previousRule.notApplicableGoTo = questionBefore.qKey;
        }
        appendRevision(previousRule, before, ruleSnapshot(previousRule), req.user.uid);
        await previousRule.save({ session });
      } else {
        const newPreviousRule = new NextQuestionRule({
          qKey: previousQuestion.qKey,
          isDefault: true,
          goToDefault: questionBefore.qKey,
          nextQuestions: []
        });
        appendRevision(newPreviousRule, null, ruleSnapshot(newPreviousRule), req.user.uid);
        await newPreviousRule.save({ session });
      }

      const insertedRule = new NextQuestionRule({
        qKey: questionBefore.qKey,
        isDefault: true,
        goToDefault: previousSuccessor,
        nextQuestions: []
      });
      appendRevision(insertedRule, null, ruleSnapshot(insertedRule), req.user.uid);
      await insertedRule.save({ session });
    });

    return res.status(201).json({
      question: createdQuestion,
      insertedAfter: req.params.qKey,
      nextQuestion: previousSuccessor
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    if (error.code === 11000) {
      return res.status(409).json({ error: 'A question with that key already exists' });
    }
    if (error.name === 'ValidationError' || error.name === 'CastError') {
      return res.status(400).json({ error: 'Question fields are invalid' });
    }

    console.error('Could not insert question into questionnaire flow:', error);
    return res.status(500).json({ error: 'Could not insert question into questionnaire flow' });
  } finally {
    if (session) {
      await session.endSession();
    }
  }
});

// PATCH /api/admin/questions/:qKey
router.patch('/questions/:qKey', async (req, res) => {
  const validationError = validateQuestionPayload(req.body, editableQuestionFields);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  try {
    const question = await Question.findOne({ qKey: req.params.qKey })
      .select('+revisionHistory');
    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    const before = questionSnapshot(question);
    question.set(req.body);
    const after = questionSnapshot(question);
    appendRevision(question, before, after, req.user.uid);

    await question.save();
    return res.json({ question: questionSnapshot(question) });
  } catch (error) {
    if (error.name === 'VersionError') {
      return res.status(409).json({
        error: 'This question changed while you were editing it. Reload and try again.'
      });
    }
    if (error.name === 'ValidationError' || error.name === 'CastError') {
      return res.status(400).json({ error: 'Question fields are invalid' });
    }

    console.error('Could not update question:', error);
    return res.status(500).json({ error: 'Could not update question' });
  }
});

// PATCH /api/admin/questions/:qKey/archive
router.patch('/questions/:qKey/archive', async (req, res) => {
  if (!isPlainObject(req.body) ||
      !containsOnlyFields(req.body, ['isArchived']) ||
      typeof req.body.isArchived !== 'boolean') {
    return res.status(400).json({ error: 'Provide a valid archive state' });
  }

  try {
    const question = await Question.findOne({ qKey: req.params.qKey })
      .select('+revisionHistory');
    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }
    if (question.isArchived === req.body.isArchived) {
      return res.json({ question: questionSnapshot(question), rewiredRules: 0 });
    }
    if (req.body.isArchived && question.qKey === questionnaireStartKey) {
      return res.status(409).json({ error: 'The questionnaire starting question cannot be archived' });
    }

    let rewiredRules = 0;
    if (req.body.isArchived) {
      const inboundRules = await NextQuestionRule.find({
        $or: [
          { isDefault: true, goToDefault: question.qKey },
          { 'nextQuestions.goTo': question.qKey },
          { notApplicableGoTo: question.qKey }
        ]
      }).select('+revisionHistory');

      if (inboundRules.length > 0) {
        const questionRule = await NextQuestionRule.findOne({ qKey: question.qKey });
        if (!questionRule || questionRule.isDefault !== true ||
            typeof questionRule.goToDefault !== 'string' ||
            questionRule.goToDefault === question.qKey) {
          return res.status(409).json({
            error: 'This question does not have one safe default successor. Update its branching rules before archiving.'
          });
        }

        const successor = questionRule.goToDefault;
        if (successor) {
          const successorExists = await Question.exists({
            qKey: successor,
            isArchived: { $ne: true }
          });
          if (!successorExists) {
            return res.status(409).json({
              error: 'This question’s default successor is unavailable. Update its branching rules before archiving.'
            });
          }
        }

        for (const rule of inboundRules) {
          const before = ruleSnapshot(rule);
          if (rule.isDefault && rule.goToDefault === question.qKey) {
            rule.goToDefault = successor;
          }
          for (const nextRule of rule.nextQuestions) {
            if (nextRule.goTo === question.qKey) {
              nextRule.goTo = successor;
            }
          }
          if (rule.notApplicableGoTo === question.qKey) {
            rule.notApplicableGoTo = successor;
          }
          appendRevision(rule, before, ruleSnapshot(rule), req.user.uid);
          await rule.save();
          rewiredRules += 1;
        }
      }
    }

    const before = questionSnapshot(question);
    question.isArchived = req.body.isArchived;
    appendRevision(question, before, questionSnapshot(question), req.user.uid);
    await question.save();

    return res.json({ question: questionSnapshot(question), rewiredRules });
  } catch (error) {
    if (error.name === 'VersionError') {
      return res.status(409).json({
        error: 'This question or one of its branching rules changed during archiving. Reload and try again.'
      });
    }
    console.error('Could not update question archive state:', error);
    return res.status(500).json({ error: 'Could not update question archive state' });
  }
});

// GET /api/admin/questions/:qKey/history
router.get('/questions/:qKey/history', async (req, res) => {
  try {
    const question = await Question.findOne({ qKey: req.params.qKey })
      .select('+revisionHistory');
    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    return res.json({ revisions: [...question.revisionHistory].reverse() });
  } catch (error) {
    console.error('Could not load question history:', error);
    return res.status(500).json({ error: 'Could not load question history' });
  }
});

// POST /api/admin/questions/:qKey/restore
router.post('/questions/:qKey/restore', async (req, res) => {
  if (!isPlainObject(req.body) ||
      !containsOnlyFields(req.body, ['changedAt', 'actorUid']) ||
      typeof req.body.changedAt !== 'string' ||
      typeof req.body.actorUid !== 'string') {
    return res.status(400).json({ error: 'Provide a valid question revision' });
  }

  const changedAt = new Date(req.body.changedAt);
  if (Number.isNaN(changedAt.getTime())) {
    return res.status(400).json({ error: 'Provide a valid question revision timestamp' });
  }

  try {
    const question = await Question.findOne({ qKey: req.params.qKey })
      .select('+revisionHistory');
    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    const matchingRevisions = question.revisionHistory.filter((revision) =>
      new Date(revision.changedAt).getTime() === changedAt.getTime() &&
      revision.actorUid === req.body.actorUid
    );
    if (matchingRevisions.length === 0) {
      return res.status(404).json({ error: 'Question revision not found' });
    }
    if (matchingRevisions.length > 1) {
      return res.status(409).json({ error: 'This revision is ambiguous. Reload the revision history and try again.' });
    }

    const revision = matchingRevisions[0];
    if (!isPlainObject(revision.before) || revision.before.qKey !== question.qKey) {
      return res.status(409).json({ error: 'This revision does not contain a restorable question snapshot' });
    }

    const restoredFields = Object.fromEntries(
      editableQuestionFields.map((field) => [
        field,
        field === 'appliesToGroup' ? revision.before[field] || '' : revision.before[field]
      ])
    );
    const validationError = validateQuestionPayload(restoredFields, editableQuestionFields, {
      requireAll: true
    });
    if (validationError) {
      return res.status(409).json({ error: 'This question revision is no longer valid for restoration' });
    }

    const before = questionSnapshot(question);
    question.set(restoredFields);
    appendRevision(question, before, questionSnapshot(question), req.user.uid);
    await question.save();

    return res.json({ question: questionSnapshot(question) });
  } catch (error) {
    if (error.name === 'VersionError') {
      return res.status(409).json({
        error: 'This question changed while you were restoring it. Reload and try again.'
      });
    }
    if (error.name === 'ValidationError' || error.name === 'CastError') {
      return res.status(400).json({ error: 'Question fields are invalid' });
    }

    console.error('Could not restore question revision:', error);
    return res.status(500).json({ error: 'Could not restore question revision' });
  }
});

// GET /api/admin/question-rules
router.get('/question-rules', async (req, res) => {
  try {
    const rules = await NextQuestionRule.find()
      .select('qKey isDefault goToDefault notApplicableGoTo nextQuestions')
      .sort({ qKey: 1 })
      .lean();
    return res.json({ rules });
  } catch (error) {
    console.error('Could not load question rules for administrator:', error);
    return res.status(500).json({ error: 'Could not load question rules' });
  }
});

// PUT /api/admin/question-rules/:qKey
router.put('/question-rules/:qKey', async (req, res) => {
  if (!isPlainObject(req.body) ||
      !containsOnlyFields(req.body, ruleFields) ||
      typeof req.body.isDefault !== 'boolean' ||
      !Array.isArray(req.body.nextQuestions) ||
      req.body.nextQuestions.length > 100) {
    return res.status(400).json({ error: 'Question rules are invalid' });
  }

  if (req.body.isDefault) {
    if (typeof req.body.goToDefault !== 'string') {
      return res.status(400).json({ error: 'The default destination must be a question key or an empty string' });
    }
  } else if (req.body.nextQuestions.length === 0) {
    return res.status(400).json({ error: 'At least one branching rule is required' });
  }

  if (req.body.nextQuestions.some((rule) =>
    !isPlainObject(rule) ||
    !containsOnlyFields(rule, ['operator', 'value', 'goTo']) ||
    typeof rule.operator !== 'string' ||
    !Object.hasOwn(rule, 'value') ||
    typeof rule.goTo !== 'string' ||
    !rule.goTo.trim()
  )) {
    return res.status(400).json({ error: 'One or more branching rules are invalid' });
  }
  if (
    Object.hasOwn(req.body, 'notApplicableGoTo') &&
    typeof req.body.notApplicableGoTo !== 'string'
  ) {
    return res.status(400).json({ error: 'The skip destination must be a question key or an empty string' });
  }

  try {
    const questionExists = await Question.exists({ qKey: req.params.qKey });
    if (!questionExists) {
      return res.status(404).json({ error: 'Question not found' });
    }

    const destinations = new Set();
    if (req.body.isDefault && req.body.goToDefault) {
      destinations.add(req.body.goToDefault);
    } else if (!req.body.isDefault) {
      req.body.nextQuestions.forEach((rule) => destinations.add(rule.goTo));
    }
    if (req.body.notApplicableGoTo) {
      destinations.add(req.body.notApplicableGoTo);
    }

    const existingDestinations = await Question.find({
      qKey: { $in: [...destinations] },
      isArchived: { $ne: true }
    }).distinct('qKey');
    if (existingDestinations.length !== destinations.size) {
      return res.status(400).json({ error: 'Every destination must be an existing question key' });
    }

    let rule = await NextQuestionRule.findOne({ qKey: req.params.qKey })
      .select('+revisionHistory');
    const before = rule ? ruleSnapshot(rule) : null;
    if (!rule) {
      rule = new NextQuestionRule({ qKey: req.params.qKey });
    }

    rule.set({
      isDefault: req.body.isDefault,
      goToDefault: req.body.goToDefault,
      notApplicableGoTo: req.body.notApplicableGoTo || '',
      nextQuestions: req.body.nextQuestions
    });
    appendRevision(rule, before, ruleSnapshot(rule), req.user.uid);

    await rule.save();
    return res.json({ rule: ruleSnapshot(rule) });
  } catch (error) {
    if (error.name === 'VersionError') {
      return res.status(409).json({
        error: 'These rules changed while you were editing them. Reload and try again.'
      });
    }
    if (error.name === 'ValidationError' || error.name === 'CastError') {
      return res.status(400).json({ error: 'Question rules are invalid' });
    }
    if (error.code === 11000) {
      return res.status(409).json({ error: 'These question rules were created by another administrator' });
    }

    console.error('Could not update question rules:', error);
    return res.status(500).json({ error: 'Could not update question rules' });
  }
});

// GET /api/admin/question-rules/:qKey/history
router.get('/question-rules/:qKey/history', async (req, res) => {
  try {
    const rule = await NextQuestionRule.findOne({ qKey: req.params.qKey })
      .select('+revisionHistory');
    if (!rule) {
      return res.json({ revisions: [] });
    }

    return res.json({ revisions: [...rule.revisionHistory].reverse() });
  } catch (error) {
    console.error('Could not load question rule history:', error);
    return res.status(500).json({ error: 'Could not load question rule history' });
  }
});

module.exports = router;
