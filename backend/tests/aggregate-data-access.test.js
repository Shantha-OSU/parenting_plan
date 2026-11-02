const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const express = require('express');

const backendRoot = path.join(__dirname, '..');
const routePath = path.join(backendRoot, 'src', 'routes', 'index.js');
const mongoosePath = require.resolve('mongoose');
const userModelPath = path.join(backendRoot, 'src', 'models', 'User.js');
const requireAdminPath = path.join(backendRoot, 'src', 'middleware', 'requireAdmin.js');
const verifyTokenPath = path.join(backendRoot, 'src', 'middleware', 'verifyToken.js');
const planModelPath = path.join(backendRoot, 'src', 'models', 'Plan.js');

function mockModule(modulePath, exports, originals) {
  const resolved = require.resolve(modulePath);
  originals.set(resolved, require.cache[resolved]);
  require.cache[resolved] = {
    id: resolved,
    filename: resolved,
    loaded: true,
    exports
  };
}

function restoreModules(originals) {
  for (const [resolved, original] of originals) {
    if (original) {
      require.cache[resolved] = original;
    } else {
      delete require.cache[resolved];
    }
  }
}

test('aggregate data requires an administrator and requests revocation-checked tokens', async (t) => {
  const originals = new Map();
  const childRoutePaths = [
    'email',
    'plan',
    'logic-engine',
    'cases',
    'invitations',
    'admin'
  ].map((route) => path.join(backendRoot, 'src', 'routes', `${route}.js`));
  const extraModulePaths = [
    path.join(backendRoot, 'src', 'models', 'Document.js'),
    path.join(backendRoot, 'src', 'models', 'StandardFormTemplate.js'),
    path.join(backendRoot, 'src', 'config', 'firebaseAdmin.js')
  ];

  let currentRole = 'user';
  let planReads = 0;
  let revocationCheckRequested = false;
  const passToken = (req, res, next) => {
    if (!req.headers.authorization?.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    req.user = {
      uid: 'test-user',
      email: 'admin@example.com',
      email_verified: true
    };
    return next();
  };
  passToken.withRevocationCheck = () => {
    revocationCheckRequested = true;
    return passToken;
  };

  mockModule(mongoosePath, { connection: { readyState: 1 } }, originals);
  mockModule(userModelPath, {
    findOne(query) {
      return {
        select: async () => (
          query.role === 'admin' && currentRole !== 'admin'
            ? null
            : { _id: 'admin-id', role: currentRole }
        )
      };
    }
  }, originals);
  mockModule(planModelPath, {
    find: () => ({
      lean: async () => {
        planReads += 1;
        return [{
          parentAge: 35,
          aggregateData: { gender: 'Woman' }
        }];
      }
    })
  }, originals);
  mockModule(verifyTokenPath, passToken, originals);
  const resolvedRequireAdminPath = require.resolve(requireAdminPath);
  originals.set(resolvedRequireAdminPath, require.cache[resolvedRequireAdminPath]);
  delete require.cache[resolvedRequireAdminPath];
  for (const modulePath of childRoutePaths) {
    mockModule(modulePath, express.Router(), originals);
  }
  for (const modulePath of extraModulePaths) {
    mockModule(modulePath, modulePath.endsWith('firebaseAdmin.js')
      ? { getFirebaseAuth: () => ({}) }
      : {}, originals);
  }

  delete require.cache[require.resolve(routePath)];
  const router = require(routePath);
  const app = express();
  app.use('/api', router);
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });

  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    delete require.cache[require.resolve(routePath)];
    delete require.cache[require.resolve(requireAdminPath)];
    restoreModules(originals);
  });

  const endpoint = `http://127.0.0.1:${server.address().port}/api/aggregate-data`;
  const denied = await fetch(endpoint, {
    headers: { Authorization: 'Bearer test-token' }
  });
  assert.equal(denied.status, 403);
  assert.equal(planReads, 0);
  assert.equal(revocationCheckRequested, true);

  currentRole = 'admin';
  const allowed = await fetch(endpoint, {
    headers: { Authorization: 'Bearer test-token' }
  });
  assert.equal(allowed.status, 200);
  assert.deepEqual(await allowed.json(), [{
    parentAge: 35,
    zipCode: null,
    collaborationMode: null,
    gender: 'Woman',
    background: null,
    race: null,
    income: null,
    household: null,
    language: null,
    education: null
  }]);
  assert.equal(planReads, 1);
});
