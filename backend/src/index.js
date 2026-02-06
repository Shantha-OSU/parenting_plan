// Load environment variables from .env file (like MONGODB_URI, PORT)
require('dotenv').config();

// Import the packages we need
const express = require('express');  // Web framework for creating APIs
const cors = require('cors');        // Allows frontend to talk to backend
const connectDB = require('./config/database');
const routes = require('./routes');
const Document = require('./models/Document');

// Create our Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware - these run on every request
app.use(cors());           // Allow requests from frontend
app.use(express.json());   // Parse JSON data from requests

// Use our routes for any URL starting with /api
app.use('/api', routes);

// Home page route
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to the Parenting API!' });
});

// Start the server
async function startServer() {
  await connectDB();  // Connect to database first
  await seedSampleDocument();

  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

startServer();

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
