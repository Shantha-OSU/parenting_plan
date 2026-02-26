// This file defines our API endpoints (URLs the frontend can call)

const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Document = require('../models/Document');
const User = require('../models/User');
const planRoutes = require('./plan');
const { getFirebaseAuth } = require('../config/firebaseAdmin');

/* Middleware to check if a user is authenticated
 * This gets used like the following
 * router.get('/dashboard', isAuthenticated, (req, res) =>{...})
**/
const isAuthenticated = (req, res, next) => {
    if (req.session.user) {
        next(); // User is authenticated, proceed to the next middleware or route handler
    } else {
        res.status(401).json({ message: 'Unauthorized, please log in' });
    }
};

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

// POST /api/login - login user
// req must contain user login info in JSON (name, email, password)
router.post('/login', requireDatabaseConnection, async (req, res) => {
  try {
    const { name, email, password } = req.body
    // database check for user
    const user = await User.findOne({email, password})
    if (user) {
      req.session.user = {
        id: '1', // generate id?
        username: name,
        role: 'user'
      }
      // found user, proceed to login
      // set session information here
      // redirect users to home page of application/dashboard
      console.log("Logging in user")
      res.status(200).json({ message: 'Login success', authenticated: true});
    } else {
      // todo: make more descriptive res depending on if password wrong, user doesn't exist, etc.
      console.error('User doesn\'t exist, login failed')
      res.status(401).send("Login failed")
    }
  } catch (err) {
    console.error('Error during user search: ', err)
    res.status(400).json({ error: err.message });
  } 
})

router.post('/logout', (req, res) => {
    req.session.destroy(err => {
        console.log('Logging out')
        if (err) {
            console.error('Failed to log out')
            return res.status(500).json({ message: 'Could not log out, please try again' });
        }
        res.status(200).json({ message: 'Successfully logged out' });
    });
});


// POST /api/create_user - create user
// req must contain user login info in JSON (name, email, password)
router.post('/createUser', requireDatabaseConnection, async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const user = await User.findOne({ email })
    // might not need this logic if unique property of email is accounted for in User.create()
    if (!user) {
      await User.create({ name, email, password })
      res.status(201);
    } else {
      console.error('Create user failed, user already exists')
      res.status(409).send('User already exists!')
    }

  } catch (err) {
    console.error('Error during user creation: ', err)
    res.status(400).json({ error: err.message });
  } 
})

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
      login: 'POST /api/login - Login a user and get current session',
      createUser: 'POST /api/createUser - Create a new user'
    }
  });
});

router.use('/plan', requireDatabaseConnection, planRoutes);

module.exports = router;
