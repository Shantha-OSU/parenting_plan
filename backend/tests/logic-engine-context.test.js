const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const express = require('express');

const backendRoot = path.join(__dirname, '..');
const routePath = path.join(backendRoot, 'src', 'routes', 'logic-engine.js');
const planModelPath = path.join(backendRoot, 'src', 'models', 'Plan.js');
const questionModelPath = path.join(backendRoot, 'src', 'models', 'Question.js');
const ruleModelPath = path.join(backendRoot, 'src', 'models', 'NextQuestionRule.js');
const verifyTokenPath = path.join(backendRoot, 'src', 'middleware', 'verifyToken.js');

function mockModule(modulePath, exports, originals) {
  const resolved = require.resolve(modulePath);
  originals.set(resolved, require.cache[resolved]);
  require.cache[resolved] = {
    id: resolved,
    filename: resolved,
    loaded: true,
    exports,
  };
}

test('context-aware navigation skips questions outside the married group', async (t) => {
  const originals = new Map();
  let currentCircumstance = 'married';
  const marriedQuestionRule = { notApplicableGoTo: 'shared_question' };

  mockModule(planModelPath, {
    findOne: async () => ({ userID: 'user-1', currentCircumstance }),
  }, originals);
  mockModule(questionModelPath, {
    findOne: async ({ qKey }) => {
      if (qKey === 'married_question') {
        return {
          qKey,
          section: 'parental-rights',
          appliesToGroup: 'married',
        };
      }
      if (qKey === 'shared_question') {
        return {
          qKey,
          section: 'parental-rights',
          appliesToGroup: '',
        };
      }
      return null;
    },
  }, originals);
  mockModule(ruleModelPath, {
    findOne: async ({ qKey }) =>
      qKey === 'married_question' ? marriedQuestionRule : null,
  }, originals);
  mockModule(verifyTokenPath, (req, res, next) => {
    req.user = { uid: 'user-1' };
    next();
  }, originals);

  delete require.cache[require.resolve(routePath)];
  const router = require(routePath);
  const app = express();
  app.use(express.json());
  app.use('/api/logic-engine', router);
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });

  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    delete require.cache[require.resolve(routePath)];
    for (const [resolved, original] of originals) {
      if (original) {
        require.cache[resolved] = original;
      } else {
        delete require.cache[resolved];
      }
    }
  });

  async function resolveStartQuestion() {
    const response = await fetch(
      `http://127.0.0.1:${server.address().port}/api/logic-engine/nextQuestionWithContext`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: 'plan-1',
          startQKey: 'married_question',
        }),
      },
    );
    return { response, body: await response.json() };
  }

  let result = await resolveStartQuestion();
  assert.equal(result.response.status, 200);
  assert.equal(result.body.qKey, 'married_question');

  for (const circumstance of [
    'never_married_seeking_custody',
    'never_married_seeking_parenting_time',
  ]) {
    currentCircumstance = circumstance;
    result = await resolveStartQuestion();
    assert.equal(result.response.status, 200);
    assert.equal(result.body.qKey, 'shared_question');
  }

  marriedQuestionRule.notApplicableGoTo = '';
  result = await resolveStartQuestion();
  assert.equal(result.response.status, 409);
  assert.match(result.body.error, /no skip destination/);
});
