// This file defines what a NextQuestionRule looks like in our database

const mongoose = require('mongoose');

const revisionSchema = new mongoose.Schema({
  actorUid: { type: String, required: true },
  changedAt: { type: Date, required: true },
  before: { type: mongoose.Schema.Types.Mixed, default: null },
  after: { type: mongoose.Schema.Types.Mixed, required: true },
}, { _id: false });

const ruleSchema = new mongoose.Schema({
  operator: {
    type: String,
    enum: ["eq", "neq", "gt", "gte", "lt", "lte", "in", "nin", "exists"],
    required: true,
  },
  value: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
    // number, string, boolean, array, etc.
    // when using ordinal operators, always specify them in the form of "userAnswer operator value"
    // For example:
    //    Our evaluation condition is that if a user's answer is greater than 5, goTo Quesion X
    // Then:
    //    value = 5
    //    operator = "gte"
    //  if "userAnswer gte 5" evaluates to true, we will goTo Question X
  },

  // if a user response evaluates to true using the operator & value, we go to the question specified
  goTo: { 
    type: String, 
  }
});

const nextQuestionRuleSchema = new mongoose.Schema({
  qKey: { 
      type: String, 
      unique: true,
      required: true
  },
  nextQuestions: {
    // this allows for branching depending on the user's answer to the current question
    type: [ruleSchema],
    default: []
  },
  isDefault: {
    // true if there is a default next question no matter the answer
    type: Boolean,
    required: true,
    default: true
  },
  goToDefault: {
    // qKey of default next question if isDefault is true
    type: String,
  },
  notApplicableGoTo: {
    type: String,
    default: ''
  },
  revisionHistory: {
    type: [revisionSchema],
    default: [],
    select: false
  },
}, { timestamps: true, optimisticConcurrency: true });

module.exports = mongoose.model('NextQuestionRule', nextQuestionRuleSchema);