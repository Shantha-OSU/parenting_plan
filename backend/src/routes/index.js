// This file defines our API endpoints (URLs the frontend can call)

const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Document = require('../models/Document');
const User = require('../models/User');
const planRoutes = require('./plan');
const { getFirebaseAuth } = require('../config/firebaseAdmin');

const requireDatabaseConnection = (req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      error: 'Database is temporarily unavailable. Please try again shortly.'
    });
  }

  return next();
};


// GET /api/health - Check if server and database are working
router.get('/health', (req, res) => {
  // Check if we're connected to MongoDB
  // readyState: 0 = disconnected, 1 = connected
  const isConnected = mongoose.connection.readyState === 1;

  res.json({
    server: 'running',
    database: isConnected ? 'connected' : 'disconnected'
  });
});

// GET /api/documents - Get all documents
router.get('/documents', requireDatabaseConnection, async (req, res) => {
  try {
    const documents = await Document.find();
    res.json(documents);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/documents/:id - Get a single document by ID
router.get('/documents/:id', requireDatabaseConnection, async (req, res) => {
  try {
    const document = await Document.findById(req.params.id);

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    res.json(document);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/documents - Create a new document
router.post('/documents', requireDatabaseConnection, async (req, res) => {
  try {
    const document = await Document.create(req.body);
    res.status(201).json(document);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// POST /api/auth/firebase/session - verify Firebase token and sync profile to MongoDB
router.post('/auth/firebase/session', requireDatabaseConnection, async (req, res) => {
  try {
    const authHeader = req.headers.authorization || ''; // Backend needs this to ensure client is authorized

    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing Bearer token' });
    }

    // Get Firebase ID token from user's verified auth header
    const idToken = authHeader.replace('Bearer ', '').trim();
    if (!idToken) {
      return res.status(401).json({ error: 'Missing Firebase ID token' });
    }

    // Extract key fields
    const decodedToken = await getFirebaseAuth().verifyIdToken(idToken);
    const email = decodedToken.email;
    const displayName = decodedToken.name || req.body.name || '';

    // Verify there is an attached email
    if (!email) {
      return res.status(400).json({ error: 'Firebase token is missing an email claim' });
    }

    const now = new Date(); // Timestamp for current login
    let syncedUser = await User.findOne({ // Search for existing Mongo user by Firebase UID or by email
      $or: [{ firebaseUid: decodedToken.uid }, { email }]
    });

    if (!syncedUser) { // If no current user in Mongo, create one
      syncedUser = await User.create({
        firebaseUid: decodedToken.uid,
        email,
        name: displayName || email.split('@')[0],
        authProvider: 'firebase',
        emailVerified: Boolean(decodedToken.email_verified),
        photoURL: decodedToken.picture || '',
        lastLoginAt: now
      });
    } else { // Else refresh key fields
      syncedUser.firebaseUid = decodedToken.uid;
      syncedUser.email = email;
      syncedUser.authProvider = 'firebase';
      syncedUser.emailVerified = Boolean(decodedToken.email_verified);
      syncedUser.photoURL = decodedToken.picture || '';
      syncedUser.lastLoginAt = now;

      if (displayName) {
        syncedUser.name = displayName;
      }

      await syncedUser.save();
    }

    // Check if Mongo and Firebase are correctly synced
    return res.status(200).json({
      message: 'Firebase user verified and synced to MongoDB',
      user: {
        id: syncedUser._id,
        firebaseUid: syncedUser.firebaseUid,
        email: syncedUser.email,
        name: syncedUser.name,
        emailVerified: syncedUser.emailVerified,
        photoURL: syncedUser.photoURL,
        authProvider: syncedUser.authProvider,
        lastLoginAt: syncedUser.lastLoginAt
      }
    });
  } catch (error) {
    const isAuthError = typeof error.code === 'string' && error.code.startsWith('auth/');
    const statusCode = isAuthError ? 401 : 500;
    const isDev = process.env.NODE_ENV === 'development';
    const fallbackMessage = isAuthError
      ? 'Invalid Firebase token'
      : 'Failed to sync Firebase profile to MongoDB';

    return res.status(statusCode).json({
      error: isDev && error.message ? error.message : fallbackMessage
    });
  }
});

// GET /api - Show available endpoints
router.get('/', (req, res) => {
  res.json({
    message: 'Parenting API',
    endpoints: {
      health: 'GET /api/health - Check server status',
      documents: 'GET /api/documents - Get all documents',
      document: 'GET /api/documents/:id - Get a document by ID',
      createDocument: 'POST /api/documents - Create a new document',
      firebaseSession: 'POST /api/auth/firebase/session - Verify Firebase token and sync user profile'
    }
  });
});

router.use('/plan', requireDatabaseConnection, planRoutes);

module.exports = router;
