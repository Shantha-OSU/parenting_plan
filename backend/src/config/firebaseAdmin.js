const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

function normalizeServiceAccount(serviceAccount) {
  if (
    serviceAccount &&
    typeof serviceAccount.private_key === 'string'
  ) {
    return {
      ...serviceAccount,
      private_key: serviceAccount.private_key.replace(/\\n/g, '\n')
    };
  }

  return serviceAccount;
}

function readServiceAccountFromEnv() {
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!json) {
    return null;
  }

  const parsed = JSON.parse(json);
  return normalizeServiceAccount(parsed);
}

function readServiceAccountFromFile() {
  const filePath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (!filePath) {
    return null;
  }

  const resolvedPath = path.isAbsolute(filePath)
    ? filePath
    : path.resolve(process.cwd(), filePath);

  const fileContent = fs.readFileSync(resolvedPath, 'utf8');
  return normalizeServiceAccount(JSON.parse(fileContent));
}

function initializeFirebaseAdmin() {
  if (admin.apps.length > 0) {
    return admin.app();
  }

  const serviceAccount = readServiceAccountFromEnv() || readServiceAccountFromFile();
  if (!serviceAccount) {
    throw new Error(
      'Missing Firebase Admin credentials. Set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_PATH.'
    );
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || serviceAccount.project_id;
  return admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId
  });
}

function isFirebaseAdminInitialized() {
  return admin.apps.length > 0;
}

function getFirebaseAdmin() {
  if (!isFirebaseAdminInitialized()) {
    throw new Error('Firebase Admin is not initialized.');
  }

  return admin;
}

module.exports = {
  initializeFirebaseAdmin,
  isFirebaseAdminInitialized,
  getFirebaseAdmin
};
