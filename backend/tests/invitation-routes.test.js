const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const express = require('express');

const invitationRoutePath = path.join(__dirname, '..', 'src', 'routes', 'invitations.js');
const caseModelPath = path.join(__dirname, '..', 'src', 'models', 'Case.js');
const invitationModelPath = path.join(__dirname, '..', 'src', 'models', 'Invitation.js');
const planModelPath = path.join(__dirname, '..', 'src', 'models', 'Plan.js');
const userModelPath = path.join(__dirname, '..', 'src', 'models', 'User.js');
const verifyTokenPath = path.join(__dirname, '..', 'src', 'middleware', 'verifyToken.js');
const emailServicePath = path.join(__dirname, '..', 'src', 'services', 'emailService.js');

function loadInvitationRouter({
  authUid = 'uid-p1',
  authEmail = 'parent1@example.com',
  Case = {},
  Invitation = {},
  Plan = {},
  User = {},
  sendInviteEmail = async () => ({ accepted: [], rejected: [], messageId: 'test' }),
} = {}) {
  const originals = new Map();

  function mockModule(modulePath, exports) {
    const resolved = require.resolve(modulePath);
    originals.set(resolved, require.cache[resolved]);
    require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports };
  }

  mockModule(caseModelPath, Case);
  mockModule(invitationModelPath, Invitation);
  mockModule(planModelPath, Plan);
  mockModule(userModelPath, User);
  mockModule(emailServicePath, { sendInviteEmail });
  mockModule(verifyTokenPath, (req, res, next) => {
    req.user = { uid: authUid, email: authEmail };
    next();
  });

  const resolvedRoute = require.resolve(invitationRoutePath);
  delete require.cache[resolvedRoute];
  const router = require(invitationRoutePath);

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
  const { router, restore } = loadInvitationRouter(options);
  const app = express();
  app.use(express.json());
  app.use('/api/v1', router);

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

test('POST /cases/:caseId/invite — P1 creates invitation and emails the co-parent', async (t) => {
  let createdInvitation = null;
  let emailedTo = null;

  const server = await createTestServer({
    authUid: 'uid-p1',
    Case: { async findById() { return { _id: 'case-1', parent1Uid: 'uid-p1', parent2Uid: null }; } },
    Invitation: {
      async create(payload) {
        createdInvitation = payload;
        return payload;
      },
    },
    sendInviteEmail: async (to) => {
      emailedTo = to;
      return { accepted: [to], rejected: [], messageId: 'msg-1' };
    },
  });
  t.after(() => server.close());

  const { response, json } = await requestJson(server.baseUrl, '/api/v1/cases/case-1/invite', {
    method: 'POST',
    body: { invitedEmail: 'coparent@example.com' },
  });

  assert.equal(response.status, 201);
  assert.equal(json.invitedEmail, 'coparent@example.com');
  assert.equal(createdInvitation.invitedEmail, 'coparent@example.com');
  assert.equal(emailedTo, 'coparent@example.com');
});

test('POST /cases/:caseId/invite — non-P1 user gets 403', async (t) => {
  const server = await createTestServer({
    authUid: 'uid-p2',
    Case: { async findById() { return { _id: 'case-1', parent1Uid: 'uid-p1', parent2Uid: null }; } },
    Invitation: { async create() { return {}; } },
  });
  t.after(() => server.close());

  const { response } = await requestJson(server.baseUrl, '/api/v1/cases/case-1/invite', {
    method: 'POST',
    body: { invitedEmail: 'someone@example.com' },
  });

  assert.equal(response.status, 403);
});

test('GET /invitations/:token — valid token returns caseId', async (t) => {
  const server = await createTestServer({
    Invitation: {
      async findOne() {
        return { token: 'valid-token', caseId: 'case-1', expiresAt: new Date(Date.now() + 86400000), status: 'pending' };
      },
    },
  });
  t.after(() => server.close());

  const { response, json } = await requestJson(server.baseUrl, '/api/v1/invitations/valid-token');

  assert.equal(response.status, 200);
  assert.equal(json.caseId, 'case-1');
});

test('GET /invitations/:token — expired token returns 410', async (t) => {
  const server = await createTestServer({
    Invitation: {
      async findOne() {
        return { token: 'old-token', caseId: 'case-1', expiresAt: new Date(Date.now() - 1000), status: 'pending' };
      },
    },
  });
  t.after(() => server.close());

  const { response, json } = await requestJson(server.baseUrl, '/api/v1/invitations/old-token');

  assert.equal(response.status, 410);
  assert.match(json.error, /expired/i);
});

test('GET /invitations/:token — already accepted token returns 410', async (t) => {
  const server = await createTestServer({
    Invitation: {
      async findOne() {
        return { token: 'used-token', caseId: 'case-1', expiresAt: new Date(Date.now() + 86400000), status: 'accepted' };
      },
    },
  });
  t.after(() => server.close());

  const { response, json } = await requestJson(server.baseUrl, '/api/v1/invitations/used-token');

  assert.equal(response.status, 410);
  assert.match(json.error, /already been accepted/i);
});

test('POST /invitations/:token/accept — happy path links parent2 to case', async (t) => {
  let caseSaved = false;
  let invitationSaved = false;

  const mockCase = {
    _id: 'case-1',
    parent1Uid: 'uid-p1',
    parent2Uid: null,
    parent1PlanId: 'plan-1',
    async save() { caseSaved = true; },
  };
  const mockInvitation = {
    caseId: 'case-1',
    token: 'good-token',
    expiresAt: new Date(Date.now() + 86400000),
    status: 'pending',
    invitedEmail: 'parent2@example.com',
    async save() { invitationSaved = true; },
  };

  const server = await createTestServer({
    authUid: 'uid-p2',
    authEmail: 'parent2@example.com',
    Invitation: { async findOne() { return mockInvitation; } },
    Case: { async findById() { return mockCase; } },
    Plan: {
      async findOne() { return { _id: 'plan-2' }; },
      async findById() { return { children: [] }; },
      async updateOne() {},
    },
    User: {
      async findOne({ firebaseUid }) {
        return { name: firebaseUid === 'uid-p1' ? 'Alice' : 'Bob', email: 'x@x.com' };
      },
    },
  });
  t.after(() => server.close());

  const { response, json } = await requestJson(server.baseUrl, '/api/v1/invitations/good-token/accept', {
    method: 'POST',
  });

  assert.equal(response.status, 200);
  assert.equal(json.caseId, 'case-1');
  assert.equal(mockCase.parent2Uid, 'uid-p2');
  assert.equal(caseSaved, true);
  assert.equal(invitationSaved, true);
});

test('POST /invitations/:token/accept — self-accept returns 403', async (t) => {
  const mockInvitation = {
    caseId: 'case-1',
    token: 'tok',
    expiresAt: new Date(Date.now() + 86400000),
    status: 'pending',
    invitedEmail: 'parent1@example.com',
    async save() {},
  };

  const server = await createTestServer({
    authUid: 'uid-p1',
    authEmail: 'parent1@example.com',
    Invitation: { async findOne() { return mockInvitation; } },
    Case: { async findById() { return { _id: 'case-1', parent1Uid: 'uid-p1', parent2Uid: null }; } },
  });
  t.after(() => server.close());

  const { response, json } = await requestJson(server.baseUrl, '/api/v1/invitations/tok/accept', {
    method: 'POST',
  });

  assert.equal(response.status, 403);
  assert.match(json.error, /cannot accept your own/i);
});

test('POST /invitations/:token/accept — wrong email returns 403', async (t) => {
  const mockInvitation = {
    caseId: 'case-1',
    token: 'tok',
    expiresAt: new Date(Date.now() + 86400000),
    status: 'pending',
    invitedEmail: 'right@example.com',
    async save() {},
  };

  const server = await createTestServer({
    authUid: 'uid-p2',
    authEmail: 'wrong@example.com',
    Invitation: { async findOne() { return mockInvitation; } },
    Case: { async findById() { return { _id: 'case-1', parent1Uid: 'uid-p1', parent2Uid: null }; } },
  });
  t.after(() => server.close());

  const { response, json } = await requestJson(server.baseUrl, '/api/v1/invitations/tok/accept', {
    method: 'POST',
  });

  assert.equal(response.status, 403);
  assert.match(json.error, /different email/i);
});

test('POST /invitations/:token/accept — third party already joined returns 409', async (t) => {
  const mockInvitation = {
    caseId: 'case-1',
    token: 'tok',
    expiresAt: new Date(Date.now() + 86400000),
    status: 'pending',
    invitedEmail: 'parent2@example.com',
    async save() {},
  };

  const server = await createTestServer({
    authUid: 'uid-p2',
    authEmail: 'parent2@example.com',
    Invitation: { async findOne() { return mockInvitation; } },
    Case: { async findById() { return { _id: 'case-1', parent1Uid: 'uid-p1', parent2Uid: 'uid-already-joined' }; } },
  });
  t.after(() => server.close());

  const { response, json } = await requestJson(server.baseUrl, '/api/v1/invitations/tok/accept', {
    method: 'POST',
  });

  assert.equal(response.status, 409);
  assert.match(json.error, /already joined/i);
});
