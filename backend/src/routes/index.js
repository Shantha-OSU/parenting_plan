// This file defines our API endpoints (URLs the frontend can call)

const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Document = require('../models/Document');
const User = require('../models/User');
const emailRoutes = require('./email');
const planRoutes = require('./plan');
const logicRoutes = require('./logic-engine');
const caseRoutes = require('./cases');
const invitationRoutes = require('./invitations');
const adminRoutes = require('./admin');
const { getFirebaseAuth } = require('../config/firebaseAdmin');
const Plan = require('../models/Plan');
const StandardFormTemplate = require('../models/StandardFormTemplate');
const verifyToken = require('../middleware/verifyToken');
const requireVerifiedAdmin = require('../middleware/requireAdmin');

const requireDatabaseConnection = (req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      error: 'Database is temporarily unavailable. Please try again shortly.'
    });
  }

  return next();
};

const requireAdmin = async (req, res, next) => {
  const user = await User.findOne({ firebaseUid: req.user.uid }).select('role');
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  req.dbUser = user;
  return next();
};

router.get('/auth/me', verifyToken, requireDatabaseConnection, async (req, res) => {
  const user = await User.findOne({ firebaseUid: req.user.uid }).select('role');
  return res.json({ role: user?.role || 'user' });
});

router.get('/form-templates/:format', verifyToken, requireDatabaseConnection, async (req, res) => {
  if (!['review', 'comparison'].includes(req.params.format)) {
    return res.status(400).json({ error: 'Invalid form template format' });
  }
  const template = await StandardFormTemplate.findOne({ format: req.params.format }).lean();
  return res.json(template);
});

router.put('/form-templates/:format', verifyToken, requireDatabaseConnection, requireAdmin, async (req, res) => {
  if (!['review', 'comparison'].includes(req.params.format)) {
    return res.status(400).json({ error: 'Invalid form template format' });
  }
  const { title, layout, blocks } = req.body;
  if (typeof title !== 'string' || !Array.isArray(blocks)) {
    return res.status(400).json({ error: 'Invalid form template' });
  }
  const template = await StandardFormTemplate.findOneAndUpdate(
    { format: req.params.format },
    { title, layout: layout === 'blank' ? layout : 'blank', blocks, updatedBy: req.dbUser._id },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
  );
  return res.json(template);
});


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
router.get('/documents', requireDatabaseConnection, verifyToken.withRevocationCheck(), requireAdmin, async (req, res) => {
  try {
    const documents = await Document.find();
    res.json(documents);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// GET /api/users - Get all users
router.get('/users', requireDatabaseConnection, verifyToken.withRevocationCheck(), requireAdmin, async (req, res) => {
  try {
    const users = await User.find()
      .select('name lname email role emailVerified authProvider createdAt lastLoginAt');
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/documents/:id - Get a single document by ID
router.get('/documents/:id', requireDatabaseConnection, verifyToken.withRevocationCheck(), requireAdmin, async (req, res) => {
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
router.post('/documents', requireDatabaseConnection, verifyToken.withRevocationCheck(), requireAdmin, async (req, res) => {
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
    if (typeof decodedToken.email !== 'string' || !decodedToken.email.trim()) {
      return res.status(400).json({ error: 'Firebase token is missing an email claim' });
    }
    const email = decodedToken.email.trim().toLowerCase();
    const displayName = decodedToken.name || req.body.name || '';

    const now = new Date(); // Timestamp for current login
    const userByUid = await User.findOne({ firebaseUid: decodedToken.uid });
    const userByEmail = await User.findOne({ email });
    if (userByUid && userByEmail && userByUid.id !== userByEmail.id) {
      return res.status(409).json({
        error: 'This account is already linked to a different Firebase identity'
      });
    }
    let syncedUser = userByUid || userByEmail;

    if (syncedUser && syncedUser.firebaseUid && syncedUser.firebaseUid !== decodedToken.uid) {
      return res.status(409).json({
        error: 'This account is already linked to a different Firebase identity'
      });
    }

    if (syncedUser && !syncedUser.firebaseUid && decodedToken.email_verified !== true) {
      return res.status(403).json({
        error: 'Verify your email before linking this account'
      });
    }

    if (!syncedUser) { // If no current user in Mongo, create one
      syncedUser = await User.create({
        firebaseUid: decodedToken.uid,
        email,
        name: displayName || email.split('@')[0],
        authProvider: 'firebase',
        emailVerified: Boolean(decodedToken.email_verified),
        role: 'user',
        permissions: [],
        lastLoginAt: now
      });
    } else { // Else refresh key fields
      syncedUser.firebaseUid = decodedToken.uid;
      syncedUser.email = email;
      syncedUser.authProvider = 'firebase';
      syncedUser.emailVerified = Boolean(decodedToken.email_verified);
      syncedUser.lastLoginAt = now;

      if (!syncedUser.role) {
        syncedUser.role = 'user';
      }

      if (!Array.isArray(syncedUser.permissions)) {
        syncedUser.permissions = [];
      }

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
        role: syncedUser.role,
        permissions: syncedUser.permissions,
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

router.get(
  '/aggregate-data',
  requireDatabaseConnection,
  verifyToken.withRevocationCheck(),
  requireVerifiedAdmin,
  async (req, res) => {
    try {
      const plans = await Plan.find(
        {},
        'parentAge zipCode collaborationMode aggregateData'
      ).lean();

      res.json(plans.map((plan) => ({
        parentAge: plan.parentAge ?? null,
        zipCode: plan.zipCode ?? null,
        collaborationMode: plan.collaborationMode ?? null,
        gender: plan.aggregateData?.gender ?? null,
        background: plan.aggregateData?.background ?? null,
        race: plan.aggregateData?.race ?? null,
        income: plan.aggregateData?.income ?? null,
        household: plan.aggregateData?.household ?? null,
        language: plan.aggregateData?.language ?? null,
        education: plan.aggregateData?.education ?? null
      })));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);
// GET /api - Show available endpoints
router.get('/', (req, res) => {
  res.json({
    message: 'Parenting API',
    endpoints: {
      health: 'GET /api/health - Check server status',
      documents: 'GET /api/documents - Get all documents',
      document: 'GET /api/documents/:id - Get a document by ID',
      createDocument: 'POST /api/documents - Create a new document',
      firebaseSession: 'POST /api/auth/firebase/session - Verify Firebase token and sync user profile',
      sendInviteEmail: 'POST /api/email/invite - Send a Gmail SMTP invite email to a submitted recipient',
      users: 'GET /api/users - List all users'
    }
  });
});

router.use('/email', emailRoutes);
router.use('/admin', requireDatabaseConnection, adminRoutes);
router.use('/plan', requireDatabaseConnection, planRoutes);
router.use('/logic-engine', requireDatabaseConnection, logicRoutes);
router.use('/v1/cases', requireDatabaseConnection, caseRoutes);
router.use('/v1', requireDatabaseConnection, invitationRoutes);

module.exports = router;
