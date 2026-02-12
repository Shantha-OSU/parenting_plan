// This file defines what a User looks like in our database

const mongoose = require('mongoose');

// A schema is like a blueprint - it describes the structure of our data
const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required() {
      return this.authProvider === 'local';
    },
    select: false
  },
  authProvider: {
    type: String,
    enum: ['local', 'google'],
    default: 'local'
  },
  firebaseUid: {
    type: String,
    unique: true,
    sparse: true
  },
  photoURL: {
    type: String,
    default: ''
  },
  lastLoginAt: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Create and export the User model
// This lets us do things like: User.find(), User.create(), etc.
module.exports = mongoose.model('User', userSchema);
