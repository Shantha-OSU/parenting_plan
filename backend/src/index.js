// Load environment variables from .env file (like MONGODB_URI, PORT)
require('dotenv').config();

// Core runtime dependencies and local modules.
const path = require('path');
const { exec } = require('child_process');
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const MongoStore = require('connect-mongo').default;
const connectDB = require('./config/database');
const routes = require('./routes');
const Document = require('./models/Document');
const { initializeFirebaseAdmin } = require('./config/firebaseAdmin');

// App bootstrap values.
const app = express();
const PORT = process.env.PORT || 3000;

// Allow browser clients to send cookies to the API and parse JSON request bodies.
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());

// Session cookie configuration. Session data is signed with SESSION_SECRET.
const sessionOptions = {
  name: 'parenting.sid',
  secret: process.env.SESSION_SECRET || 'dev-session-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 24 * 7
  }
};

// Persist sessions in MongoDB when available so login survives server restarts.
if (process.env.MONGODB_URI) {
  sessionOptions.store = MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    collectionName: 'sessions'
  });
} else {
  console.warn('MONGODB_URI is not set. Falling back to in-memory session store.');
}

app.use(session(sessionOptions));

// Serve the login page and static frontend assets from /src/public.
app.use(express.static(path.join(__dirname, 'public')));

// API routes (auth, documents, etc.) are exposed under /api.
app.use('/api', routes);

// Root route for local development: open the sign-in page first.
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Start order: DB connection, initial seed data, Firebase Admin, then HTTP server.
async function startServer() {
  await connectDB();
  await seedSampleDocument();

  // Firebase Admin is used server-side to verify Google/Firebase ID tokens.
  try {
    initializeFirebaseAdmin();
    console.log('Firebase Admin initialized.');
  } catch (error) {
    console.warn(`Firebase Admin initialization skipped: ${error.message}`);
  }

  app.listen(PORT, () => {
    const appUrl = `http://localhost:${PORT}`;
    console.log(`Server running at ${appUrl}`);

    // Convenience for local dev so the login page opens automatically.
    if (process.env.OPEN_BROWSER_ON_START !== 'false') {
      openBrowser(appUrl);
    }
  });
}

startServer();

// Seed a starter document once so the app has data during early development.
async function seedSampleDocument() {
  try {
    const count = await Document.countDocuments();
    if (count > 0) {
      return;
    }

    await Document.create({
      title: 'Parenting Plan Intake',
      version: 1,
      isActive: true,
      sections: [
        {
          id: 'parent-info',
          title: 'Parent Information',
          description: 'Basic details for each parent',
          order: 0,
          questions: [
            {
              id: 'parent1_full_name',
              label: 'Parent 1 Full Name',
              type: 'text',
              required: true,
              order: 0
            },
            {
              id: 'parent1_email',
              label: 'Parent 1 Email',
              type: 'text',
              required: true,
              order: 1
            },
            {
              id: 'parent2_full_name',
              label: 'Parent 2 Full Name',
              type: 'text',
              required: true,
              order: 2
            },
            {
              id: 'parent2_email',
              label: 'Parent 2 Email',
              type: 'text',
              required: true,
              order: 3
            }
          ]
        },
        {
          id: 'child-info',
          title: 'Child Information',
          description: 'Children and safety considerations',
          order: 1,
          questions: [
            {
              id: 'child_count',
              label: 'How many children are involved?',
              type: 'number',
              required: true,
              order: 0
            },
            {
              id: 'children_names',
              label: 'Children names',
              type: 'textarea',
              required: false,
              order: 1
            },
            {
              id: 'has_domestic_violence',
              label: 'Is there a history of domestic violence?',
              type: 'boolean',
              required: true,
              order: 2
            },
            {
              id: 'dv_details',
              label: 'Please share relevant details',
              type: 'textarea',
              required: false,
              visibility: {
                dependsOn: 'has_domestic_violence',
                equals: true
              },
              order: 3
            }
          ]
        }
      ]
    });

    console.log('Seeded sample Document');
  } catch (error) {
    console.error('Could not seed sample Document:', error.message);
  }
}

// Cross-platform helper for launching the system browser.
function openBrowser(url) {
  const commandByPlatform = {
    win32: `start "" "${url}"`,
    darwin: `open "${url}"`,
    linux: `xdg-open "${url}"`
  };

  const command = commandByPlatform[process.platform];
  if (!command) {
    return;
  }

  exec(command, (error) => {
    if (error) {
      console.warn(`Could not open browser automatically: ${error.message}`);
    }
  });
}
