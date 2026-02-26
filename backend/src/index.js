// Load environment variables from .env file (like MONGODB_URI, PORT)
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

// Import the packages we need
const express = require('express');  // Web framework for creating APIs
const cors = require('cors');        // Allows frontend to talk to backend
const session = require('express-session');
const MongoStore = require('connect-mongo');
const { connectDB } = require('./config/database');
const routes = require('./routes');

// Create our Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware - these run on every request
app.use(cors());           // Allow requests from frontend
app.use(express.json());   // Parse JSON data from requests

// Session middleware - required for req.session to work in routes
if (!process.env.SESSION_SECRET) {
  console.warn('SESSION_SECRET is not set. Using an insecure default — set SESSION_SECRET in production.');
}
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
  resave: false,
  saveUninitialized: false,
  store: process.env.MONGODB_URI
    ? MongoStore.create({ mongoUrl: process.env.MONGODB_URI })
    : undefined,
  cookie: { secure: process.env.NODE_ENV === 'production', httpOnly: true, sameSite: 'lax' }
}));

// Use our routes for any URL starting with /api
app.use('/api', routes);

// Home page route
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to the Parenting API!' });
});

// Start the server
async function startServer() {
  // Attempt DB connection, but keep API available even if DB is temporarily down.
  connectDB();

  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

startServer();
