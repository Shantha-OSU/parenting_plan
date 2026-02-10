// This file defines what a User looks like in our database

const mongoose = require('mongoose');

// A schema is like a blueprint - it describes the structure of our data
const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true   // User must have a name
  },
  email: {
    type: String,
    required: true,
    unique: true     // No two users can have the same email
  },
  password: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now  // Automatically set to current time
  }
});

// Create and export the User model
// This lets us do things like: User.find(), User.create(), etc.
module.exports = mongoose.model('User', userSchema);
