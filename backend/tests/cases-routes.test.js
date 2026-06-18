const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const express = require('express');

const casesRoutePath = path.join(__dirname, '..', 'src', 'routes', 'cases.js');
const caseModelPath = path.join(__dirname, '..', 'src', 'models', 'Case.js');
const planModelPath = path.join(__dirname, '..', 'src', 'models', 'Plan.js');
const userModelPath = path.join(__dirname, '..', 'src', 'models', 'User.js');
const qrModelPath = path.join(__dirname, '..', 'src', 'models', 'QuestionnaireResponse.js');
const resolutionModelPath = path.join(__dirname, '..', 'src', 'models', 'Resolution.js');
const resolutionReviewModelPath = path.join(__dirname, '..', 'src', 'models', 'ResolutionReview.js');
const verifyTokenPath = path.join(__dirname, '..', 'src', 'middleware', 'verifyToken.js');
const comparisonServicePath = path.join(__dirname, '..', 'src', 'services', 'comparisonService.js');

function loadCasesRouter({
  authUid = 'uid-p1',
  Case = {},
  Plan = {},
  User = {},
  QuestionnaireResponse = {},
  Resolution = {},
  ResolutionReview = {},
  computeDiff = () => [],
} = {}) {
  const originals = new Map();

  function mockModule(modulePath, exports) {
    const resolved = require.resolve(modulePath);
    originals.set(resolved, require.cache[resolved]);
    require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports };
  }

  mockModule(caseModelPath, Case);
  mockModule(planModelPath, Plan);
  mockModule(userModelPath, User);
  mockModule(qrModelPath, QuestionnaireResponse);
  mockModule(resolutionModelPath, Resolution);
  mockModule(resolutionReviewModelPath, ResolutionReview);
  mockModule(comparisonServicePath, { computeDiff });
  mockModule(verifyTokenPath, (req, res, next) => {
    req.user = { uid: authUid };
    next();
  });

  const resolvedRoute = require.resolve(casesRoutePath);
  delete require.cache[resolvedRoute];
  const router = require(casesRoutePath);

  return {
    router,
    restore() {
      delete require.cache[resolvedRoute];
      for (const [resolved, original] of originals.entries()) {
        if (original) require.cache[resolved] = original;
        else delete require.cache[resolved];
      }
    },
  };
}

async function createTestServer(options) {
  const { router, restore } = loadCasesRouter(options);
  const app = express();
  app.use(express.json());
  app.use('/api/v1/cases', router);

  const server = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });

  return {
    baseUrl: `http://127.0.0.1:${server.address().port}`,
    async close() {
      await new Promise((resolve) => server.close(resolve));
      restore();
    },
  };
}

async function requestJson(baseUrl, routePath, { method = 'GET', body } = {}) {
  const response = await fetch(`${baseUrl}${routePath}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  return { response, json: text ? JSON.parse(text) : null };
}

// ─── Tests ─────────────────────────────────────────────────────────────────

test('GET /cases/:caseId/status — returns status and isParent1 flag for a case member', async (t) => {
  const server = await createTestServer({
    authUid: 'uid-p1',
    Case: {
      async findById() {
        return { _id: 'case-1', status: 'comparison_ready', parent1Uid: 'uid-p1', parent2Uid: 'uid-p2' };
      },
    },
  });
  t.after(() => server.close());

  const { response, json } = await requestJson(server.baseUrl, '/api/v1/cases/case-1/status');

  assert.equal(response.status, 200);
  assert.equal(json.status, 'comparison_ready');
  assert.equal(json.isParent1, true);
});

test('GET /cases/:caseId/status — non-member gets 403', async (t) => {
  const server = await createTestServer({
    authUid: 'uid-stranger',
    Case: {
      async findById() {
        return { _id: 'case-1', status: 'pending_invite', parent1Uid: 'uid-p1', parent2Uid: 'uid-p2' };
      },
    },
  });
  t.after(() => server.close());

  const { response } = await requestJson(server.baseUrl, '/api/v1/cases/case-1/status');

  assert.equal(response.status, 403);
});

test('PUT /cases/:caseId/my-responses — saves draft answers', async (t) => {
  let updateFilter = null;
  let updatePayload = null;

  const server = await createTestServer({
    authUid: 'uid-p1',
    Case: { async findById() { return { _id: 'case-1', parent1Uid: 'uid-p1', parent2Uid: 'uid-p2' }; } },
    QuestionnaireResponse: {
      async findOne() { return null; },
      async findOneAndUpdate(filter, data) {
        updateFilter = filter;
        updatePayload = data;
        return { caseId: 'case-1', parentUid: 'uid-p1', answers: data.$set.answers, isComplete: false };
      },
    },
  });
  t.after(() => server.close());

  const { response } = await requestJson(server.baseUrl, '/api/v1/cases/case-1/my-responses', {
    method: 'PUT',
    body: { answers: { q1: 'yes' } },
  });

  assert.equal(response.status, 200);
  assert.equal(updateFilter.parentUid, 'uid-p1');
  assert.deepEqual(updatePayload.$set.answers, { q1: 'yes' });
});

test('PUT /cases/:caseId/my-responses — returns 409 if responses already submitted', async (t) => {
  const server = await createTestServer({
    authUid: 'uid-p1',
    Case: { async findById() { return { _id: 'case-1', parent1Uid: 'uid-p1', parent2Uid: 'uid-p2' }; } },
    QuestionnaireResponse: {
      async findOne() { return { isComplete: true }; },
    },
  });
  t.after(() => server.close());

  const { response, json } = await requestJson(server.baseUrl, '/api/v1/cases/case-1/my-responses', {
    method: 'PUT',
    body: { answers: { q1: 'no' } },
  });

  assert.equal(response.status, 409);
  assert.match(json.error, /cannot be changed/i);
});

test('POST /cases/:caseId/my-responses/submit — transitions to comparison_ready when both parents done', async (t) => {
  let savedStatus = null;

  const mockCase = {
    _id: 'case-1',
    parent1Uid: 'uid-p1',
    parent2Uid: 'uid-p2',
    status: 'pending_invite',
    async save() { savedStatus = this.status; },
  };

  const server = await createTestServer({
    authUid: 'uid-p1',
    Case: { async findById() { return mockCase; } },
    QuestionnaireResponse: {
      async findOneAndUpdate() { return { isComplete: true }; },
      async findOne({ parentUid }) {
        if (parentUid === 'uid-p2') return { isComplete: true };
        return null;
      },
    },
  });
  t.after(() => server.close());

  const { response, json } = await requestJson(server.baseUrl, '/api/v1/cases/case-1/my-responses/submit', {
    method: 'POST',
  });

  assert.equal(response.status, 200);
  assert.equal(json.caseStatus, 'comparison_ready');
  assert.equal(savedStatus, 'comparison_ready');
});

test('GET /cases/:caseId/comparison — returns 403 when case is not yet comparison_ready', async (t) => {
  const server = await createTestServer({
    authUid: 'uid-p1',
    Case: {
      async findById() {
        return { _id: 'case-1', parent1Uid: 'uid-p1', parent2Uid: 'uid-p2', status: 'pending_invite' };
      },
    },
  });
  t.after(() => server.close());

  const { response } = await requestJson(server.baseUrl, '/api/v1/cases/case-1/comparison');

  assert.equal(response.status, 403);
});

test('POST /cases/:caseId/merge — creates shared plans for both parents and marks case resolved', async (t) => {
  const createdPlans = [];
  let savedStatus = null;

  const mockCase = {
    _id: 'case-1',
    parent1Uid: 'uid-p1',
    parent2Uid: 'uid-p2',
    parent1PlanId: 'plan-1',
    mergedAnswers: {},
    status: 'comparison_ready',
    async save() { savedStatus = this.status; },
  };

  const server = await createTestServer({
    authUid: 'uid-p1',
    Case: { async findById() { return mockCase; } },
    Plan: {
      async findById() { return { children: [{ name: 'Child A' }] }; },
      async create(payload) { createdPlans.push(payload); return payload; },
    },
    User: {
      async findOne({ firebaseUid }) {
        return { name: firebaseUid === 'uid-p1' ? 'Alice' : 'Bob', email: 'x@x.com' };
      },
    },
  });
  t.after(() => server.close());

  const { response } = await requestJson(server.baseUrl, '/api/v1/cases/case-1/merge', {
    method: 'POST',
    body: { mergedAnswers: { q1: 'agree', q2: null } },
  });

  assert.equal(response.status, 200);
  assert.equal(createdPlans.length, 2);
  assert.equal(savedStatus, 'resolved');
  // null answers must be filtered out before plan creation
  assert.ok(createdPlans[0].answers.every((a) => a.answer != null));
});

test('POST /cases/:caseId/resolutions — P1 submits, status transitions to resolutions_pending', async (t) => {
  let savedStatus = null;

  const mockCase = {
    _id: 'case-1',
    parent1Uid: 'uid-p1',
    parent2Uid: 'uid-p2',
    status: 'comparison_ready',
    async save() { savedStatus = this.status; },
  };

  const server = await createTestServer({
    authUid: 'uid-p1',
    Case: { async findById() { return mockCase; } },
    Resolution: { async findOneAndUpdate() { return {}; } },
  });
  t.after(() => server.close());

  const { response } = await requestJson(server.baseUrl, '/api/v1/cases/case-1/resolutions', {
    method: 'POST',
    body: { resolutions: [{ qKey: 'q1', proposedAnswer: 'yes' }] },
  });

  assert.equal(response.status, 200);
  assert.equal(savedStatus, 'resolutions_pending');
});

test('POST /cases/:caseId/resolutions — P2 attempting to submit gets 403', async (t) => {
  const server = await createTestServer({
    authUid: 'uid-p2',
    Case: {
      async findById() {
        return { _id: 'case-1', parent1Uid: 'uid-p1', parent2Uid: 'uid-p2', status: 'comparison_ready' };
      },
    },
  });
  t.after(() => server.close());

  const { response } = await requestJson(server.baseUrl, '/api/v1/cases/case-1/resolutions', {
    method: 'POST',
    body: { resolutions: [{ qKey: 'q1', proposedAnswer: 'yes' }] },
  });

  assert.equal(response.status, 403);
});

test('POST /cases/:caseId/resolutions/review — P2 submits review, status transitions to resolutions_reviewed', async (t) => {
  let savedStatus = null;

  const mockCase = {
    _id: 'case-1',
    parent1Uid: 'uid-p1',
    parent2Uid: 'uid-p2',
    status: 'resolutions_pending',
    async save() { savedStatus = this.status; },
  };

  const server = await createTestServer({
    authUid: 'uid-p2',
    Case: { async findById() { return mockCase; } },
    ResolutionReview: { async findOneAndUpdate() { return {}; } },
  });
  t.after(() => server.close());

  const { response } = await requestJson(server.baseUrl, '/api/v1/cases/case-1/resolutions/review', {
    method: 'POST',
    body: { reviews: [{ qKey: 'q1', accepted: true }] },
  });

  assert.equal(response.status, 200);
  assert.equal(savedStatus, 'resolutions_reviewed');
});

test('POST /cases/:caseId/resolutions/review — P1 attempting to submit gets 403', async (t) => {
  const server = await createTestServer({
    authUid: 'uid-p1',
    Case: {
      async findById() {
        return { _id: 'case-1', parent1Uid: 'uid-p1', parent2Uid: 'uid-p2', status: 'resolutions_pending' };
      },
    },
  });
  t.after(() => server.close());

  const { response } = await requestJson(server.baseUrl, '/api/v1/cases/case-1/resolutions/review', {
    method: 'POST',
    body: { reviews: [{ qKey: 'q1', accepted: true }] },
  });

  assert.equal(response.status, 403);
});

test('POST /cases/:caseId/resolutions/final — all flagged items addressed → status resolved', async (t) => {
  let savedStatus = null;

  const mockCase = {
    _id: 'case-1',
    parent1Uid: 'uid-p1',
    parent2Uid: 'uid-p2',
    status: 'resolutions_reviewed',
    async save() { savedStatus = this.status; },
  };

  const server = await createTestServer({
    authUid: 'uid-p1',
    Case: { async findById() { return mockCase; } },
    Resolution: {
      async findOneAndUpdate() { return {}; },
      async findOne() { return { resolutions: [{ qKey: 'q1', proposedAnswer: 'yes' }] }; },
    },
    ResolutionReview: {
      // P2 flagged q1; P1 will address it in finalAnswers
      async findOne() { return { reviews: [{ qKey: 'q1', accepted: false }] }; },
    },
  });
  t.after(() => server.close());

  const { response, json } = await requestJson(server.baseUrl, '/api/v1/cases/case-1/resolutions/final', {
    method: 'POST',
    body: { finalAnswers: { q1: 'new answer' } },
  });

  assert.equal(response.status, 200);
  assert.equal(json.status, 'resolved');
  assert.equal(savedStatus, 'resolved');
});

test('POST /cases/:caseId/resolutions/final — unaddressed flagged items → status needs_discussion', async (t) => {
  let savedStatus = null;

  const mockCase = {
    _id: 'case-1',
    parent1Uid: 'uid-p1',
    parent2Uid: 'uid-p2',
    status: 'resolutions_reviewed',
    async save() { savedStatus = this.status; },
  };

  const server = await createTestServer({
    authUid: 'uid-p1',
    Case: { async findById() { return mockCase; } },
    Resolution: {
      async findOneAndUpdate() { return {}; },
      async findOne() { return { resolutions: [] }; },
    },
    ResolutionReview: {
      // P2 flagged both q1 and q2; P1 only addresses q1
      async findOne() { return { reviews: [{ qKey: 'q1', accepted: false }, { qKey: 'q2', accepted: false }] }; },
    },
  });
  t.after(() => server.close());

  const { response, json } = await requestJson(server.baseUrl, '/api/v1/cases/case-1/resolutions/final', {
    method: 'POST',
    body: { finalAnswers: { q1: 'addressed' } },
  });

  assert.equal(response.status, 200);
  assert.equal(json.status, 'needs_discussion');
  assert.equal(savedStatus, 'needs_discussion');
});
