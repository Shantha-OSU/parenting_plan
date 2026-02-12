const express = require('express');
const router = express.Router();
const Document = require('../models/Document');
const User = require('../models/User');
const {
  getFirebaseAdmin,
  isFirebaseAdminInitialized
} = require('../config/firebaseAdmin');

const requiredFirebaseConfig = [
  'FIREBASE_API_KEY',
  'FIREBASE_AUTH_DOMAIN',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_APP_ID'
];

const isAuthenticated = (req, res, next) => {
  if (req.session && req.session.user) {
    return next();
  }

  return res.status(401).json({ message: 'Unauthorized, please log in' });
};

router.get('/health', (req, res) => {
  const mongoose = require('mongoose');
  const isConnected = mongoose.connection.readyState === 1;

  res.json({
    server: 'running',
    database: isConnected ? 'connected' : 'disconnected'
  });
});

router.get('/auth/config', (req, res) => {
  const missing = requiredFirebaseConfig.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    return res.status(500).json({
      error: `Missing Firebase web config env vars: ${missing.join(', ')}`
    });
  }

  return res.json({
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID,
    measurementId: process.env.FIREBASE_MEASUREMENT_ID
  });
});

router.post('/auth/session-login', async (req, res) => {
  try {
    if (!isFirebaseAdminInitialized()) {
      return res.status(503).json({
        error: 'Firebase Admin is not initialized. Set service account env vars first.'
      });
    }

    const { idToken } = req.body;
    if (!idToken) {
      return res.status(400).json({ error: 'idToken is required' });
    }

    const admin = getFirebaseAdmin();
    const decodedToken = await admin.auth().verifyIdToken(idToken);

    if (!decodedToken.email) {
      return res.status(400).json({ error: 'Google account email is required.' });
    }

    let user = await User.findOne({
      $or: [
        { firebaseUid: decodedToken.uid },
        { email: decodedToken.email.toLowerCase() }
      ]
    });

    if (!user) {
      user = new User({
        name: decodedToken.name || decodedToken.email,
        email: decodedToken.email,
        authProvider: 'google',
        firebaseUid: decodedToken.uid,
        photoURL: decodedToken.picture || ''
      });
    } else {
      user.name = decodedToken.name || user.name;
      user.email = decodedToken.email;
      user.authProvider = 'google';
      user.firebaseUid = decodedToken.uid;
      user.photoURL = decodedToken.picture || user.photoURL || '';
      user.lastLoginAt = new Date();
    }

    await user.save();

    req.session.user = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      authProvider: user.authProvider,
      firebaseUid: user.firebaseUid
    };

    return res.status(200).json({
      message: 'Login success',
      authenticated: true,
      user: req.session.user
    });
  } catch (error) {
    console.error('Firebase login failed:', error);
    return res.status(401).json({ error: 'Firebase login failed' });
  }
});

router.get('/auth/me', (req, res) => {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ authenticated: false });
  }

  return res.json({
    authenticated: true,
    user: req.session.user
  });
});

router.post('/auth/logout', (req, res) => {
  if (!req.session) {
    return res.status(200).json({ message: 'No active session' });
  }

  return req.session.destroy((error) => {
    if (error) {
      console.error('Failed to log out', error);
      return res.status(500).json({ message: 'Could not log out, please try again' });
    }

    res.clearCookie('parenting.sid');
    return res.status(200).json({ message: 'Successfully logged out' });
  });
});

router.get('/documents', isAuthenticated, async (req, res) => {
  try {
    const documents = await Document.find();
    return res.json(documents);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/documents/:id', isAuthenticated, async (req, res) => {
  try {
    const document = await Document.findById(req.params.id);
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    return res.json(document);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/documents', isAuthenticated, async (req, res) => {
  try {
    const document = await Document.create(req.body);
    return res.status(201).json(document);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({
      email: (email || '').toLowerCase(),
      password,
      authProvider: 'local'
    });

    if (!user) {
      return res.status(401).json({ error: 'Login failed' });
    }

    req.session.user = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      authProvider: user.authProvider
    };

    return res.status(200).json({ message: 'Login success', authenticated: true });
  } catch (error) {
    console.error('Error during user search:', error);
    return res.status(400).json({ error: error.message });
  }
});

router.post('/logout', (req, res) => {
  return req.session.destroy((error) => {
    if (error) {
      console.error('Failed to log out', error);
      return res.status(500).json({ message: 'Could not log out, please try again' });
    }

    res.clearCookie('parenting.sid');
    return res.status(200).json({ message: 'Successfully logged out' });
  });
});

router.post('/createUser', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const normalizedEmail = (email || '').toLowerCase();

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({ error: 'User already exists' });
    }

    const newUser = await User.create({
      name,
      email: normalizedEmail,
      password,
      authProvider: 'local'
    });

    return res.status(201).json({
      id: newUser._id,
      name: newUser.name,
      email: newUser.email
    });
  } catch (error) {
    console.error('Error during user creation:', error);
    return res.status(400).json({ error: error.message });
  }
});

router.get('/', (req, res) => {
  res.json({
    message: 'Parenting API',
    endpoints: {
      health: 'GET /api/health - Check server status',
      firebaseConfig: 'GET /api/auth/config - Firebase web config',
      firebaseSessionLogin: 'POST /api/auth/session-login - Verify Firebase ID token',
      currentUser: 'GET /api/auth/me - Get authenticated user from session',
      firebaseLogout: 'POST /api/auth/logout - End authenticated session',
      documents: 'GET /api/documents - Get all documents (authenticated)',
      document: 'GET /api/documents/:id - Get a document by ID (authenticated)',
      createDocument: 'POST /api/documents - Create a new document (authenticated)',
      login: 'POST /api/login - Local login',
      createUser: 'POST /api/createUser - Local user signup'
    }
  });
});

module.exports = router;
