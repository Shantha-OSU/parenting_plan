const express = require('express');
const router = express.Router();
const Question = require('../models/Question');
const NextQuestionRule = require('../models/NextQuestionRule');
const Plan = require('../models/Plan');
const verifyToken = require('../middleware/verifyToken');
const questionLogicHandler = require('../lib/question-logic-handler.js')

function getCircumstanceGroup(currentCircumstance) {
  if (currentCircumstance === 'married') return 'married';
  if ([
    'never_married_seeking_custody',
    'never_married_seeking_parenting_time',
  ].includes(currentCircumstance)) {
    return 'not_married';
  }
  return null;
}

async function findNextApplicableQuestion(startQKey, circumstanceGroup) {
  let qKey = startQKey;
  const visited = new Set();

  while (qKey) {
    if (visited.has(qKey)) {
      const error = new Error(`Question skip loop detected at "${qKey}"`);
      error.statusCode = 409;
      throw error;
    }
    visited.add(qKey);
    if (visited.size > 100) {
      const error = new Error('Question skip chain exceeds the maximum length');
      error.statusCode = 409;
      throw error;
    }

    const question = await Question.findOne({
      qKey,
      isArchived: { $ne: true },
    });
    if (!question) {
      const error = new Error(`Question "${qKey}" was not found or is archived`);
      error.statusCode = 404;
      throw error;
    }

    if (!question.appliesToGroup || question.appliesToGroup === circumstanceGroup) {
      return question;
    }

    const questionRule = await NextQuestionRule.findOne({ qKey });
    if (!questionRule?.notApplicableGoTo) {
      const error = new Error(
        `Question "${qKey}" does not apply to this circumstance and has no skip destination`,
      );
      error.statusCode = 409;
      throw error;
    }
    qKey = questionRule.notApplicableGoTo;
  }

  return null;
}

// GET /api/logic-engine/nextQuestion/:qkey/:answer - get next question from answer to current question
router.get('/nextQuestion/:qkey/:answer', async (req, res) => {
  const userAnswer = req.params.answer
  const qKey = req.params.qkey
  const nextQRules = await NextQuestionRule.findOne({qKey: qKey})
  
  if (nextQRules == null) {
    console.log("Failed to retrieve NextQuestionRule using qkey: " + qKey)
    res.status(404).send()
  }

  const next = nextQRules.isDefault 
    ? nextQRules.goToDefault 
    : nextQRules.nextQuestions.find(rule => questionLogicHandler.evaluate(userAnswer, rule.operator, rule.value)).goTo
  try {
    const nextQ = await Question.findOne({ qKey: next, isArchived: { $ne: true } })
    console.log("Returning next question of id: " + next)
    res.status(200).json(nextQ)
  } catch(err) {
    console.error("Failed to find next question of id: " + next)
    res.status(400).json({ error: err.message})
  }
});

// POST /api/logic-engine/nextQuestionWithContext
router.post('/nextQuestionWithContext', verifyToken, async (req, res) => {
  try {
    const { planId, qKey, answer, startQKey } = req.body || {};
    const isStartingAtQuestion = typeof startQKey === 'string' && startQKey.length > 0;
    if (
      typeof planId !== 'string' ||
      (isStartingAtQuestion
        ? qKey !== undefined || answer !== undefined
        : typeof qKey !== 'string' || typeof answer !== 'string') ||
      (startQKey !== undefined && !isStartingAtQuestion)
    ) {
      return res.status(400).json({ error: 'A plan and valid question transition are required' });
    }

    const plan = await Plan.findOne({ _id: planId, userID: req.user.uid });
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    const legacyCircumstance = plan.userRole;
    const currentCircumstance = plan.currentCircumstance || (
      [
        'married',
        'never_married_seeking_custody',
        'never_married_seeking_parenting_time',
      ].includes(legacyCircumstance)
        ? legacyCircumstance
        : ''
    );
    const circumstanceGroup = getCircumstanceGroup(currentCircumstance);
    if (!circumstanceGroup) {
      return res.status(409).json({ error: 'Complete your current circumstance before continuing' });
    }

    let destinationQKey = isStartingAtQuestion ? startQKey : '';
    if (!isStartingAtQuestion) {
      const currentQuestion = await Question.findOne({
        qKey,
        isArchived: { $ne: true },
      });
      if (!currentQuestion) {
        return res.status(404).json({ error: 'Current question not found or is archived' });
      }

      const rule = await NextQuestionRule.findOne({ qKey });
      if (!rule) {
        return res.status(404).json({ error: 'No next-question rule was found' });
      }

      if (rule.isDefault) {
        destinationQKey = rule.goToDefault;
      } else {
        const matchingRule = rule.nextQuestions.find((nextRule) =>
          questionLogicHandler.evaluate(answer, nextRule.operator, nextRule.value)
        );
        if (!matchingRule) {
          return res.status(409).json({ error: `No branching rule matched the answer for "${qKey}"` });
        }
        destinationQKey = matchingRule.goTo;
      }
    }

    if (!destinationQKey) {
      return res.json(null);
    }

    const nextQuestion = await findNextApplicableQuestion(destinationQKey, circumstanceGroup);
    return res.json(nextQuestion);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Could not resolve next applicable question:', error);
    return res.status(500).json({ error: 'Could not resolve next question' });
  }
});

// GET /api/logic-engine/questions - Get all questions
router.get('/questions', async (req, res) => {
  try {
    const questions = await Question.find({ isArchived: { $ne: true } });
    res.json(questions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/logic-engine/question-rules - Get all next question rules
router.get('/next-question-rules', async (req, res) => {
  try {
    const rules = await NextQuestionRule.find();
    res.json(rules);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/logic-engine/questions/:section - Get all questions from the section specified
router.get('/questions/:section', async (req, res) => {
  try {
    const questions = await Question.find({
      section: req.params.section,
      isArchived: { $ne: true }
    });
    res.json(questions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/logic-engine/question/:qkey - Get the questions with the specified qkey
router.get('/question/:qkey', async (req, res) => {
  try {
    const questions = await Question.findOne({
      qKey: req.params.qkey,
      isArchived: { $ne: true }
    });
    res.json(questions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
