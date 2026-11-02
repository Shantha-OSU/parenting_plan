const mongoose = require('mongoose');

const questionResponseSchema = new mongoose.Schema(
{
  qKey: { 
    type: String, 
    required: true 
  },
  answer: { 
    type: mongoose.Schema.Types.Mixed, 
    required: true 
  },
  isFlagged: {
    // future proofing for potential "flagging" a question feature to come back to later
    type: Boolean,
    required: true,
    default: false },
  isDeferred: {
    // future proofing for potential of deferring a question feature to come back to later
    type: Boolean,
    required: true,
    default: false },
  timestamp: { type: Date, default: Date.now }
});

const childSchema = new mongoose.Schema(
  {
    fName: {
      type: String,
      required: true
    },
    lName: {
      type: String,
      required: true
    },
    age: {
      type: Number,
      min: 0,
      max: 120
    },
    birthday: {
      type: String,
      required: true
    },
    classifications: {
      type: [String],
      enum: [
        'under-18',
        'disabled',
        'emancipated-adult'
      ],
      required: true,
      default: []
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  },
  { _id: true }
);

const planSchema = new mongoose.Schema(
{
  userID: { 
    type: String, 
    required: true 
  },
  name: {
    type: String,
    default: 'Untitled Plan'
  },
  phoneNumber: {
    type: String,
    default: ''
  },
  parentAge: {
    type: Number,
    min: 0,
    max: 120
  },
  streetAddress: {
    type: String,
    default: ''
  },
  addressLine2: {
    type: String,
    default: ''
  },
  city: {
    type: String,
    default: ''
  },
  state: {
    type: String,
    default: ''
  },
  zipCode: {
    type: String,
    default: ''
  },
  aggregateData: {
    type: mongoose.Schema.Types.Mixed,
    default: () => ({})
  },
  status: { 
    type: String, enum: ['in_progress', 'completed', 'ready_for_review', 'DRAFT'], 
    default: 'in_progress' 
  },
  currentQuestion: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Question"
  },
  collaborationMode: {
    //TODO Update this
    type: String,
    enum: ['collaborative', 'individual', 'locked-individual', ''],
    default: ''
  },
  parentFName: {
    type: String,
    default: ''
  },
  parentLName: {
    type: String,
    default: ''
  },
  userRole: {
    type: String,
    enum: ['parent1/petitioner1/plaintiff', 'parent2/petitioner2/defendant', 'no_case', 'flagged', 'defer', ''],
    default: ''
  },
  residentialParent: {
    type: String,
    default: ''
  },
  isShared: {
    type: Boolean,
    default: false
  },
  isParent2: {
    type: Boolean,
    default: false
  },
  lastModified: {
    type: String,
    required: true,
    default: new Date().toLocaleDateString('en-US')
  },
  caseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Case',
    default: null
  },
  parentingTimeAndCommunication: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  informationSharing: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  taxExemptions: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  answers: [questionResponseSchema],
  children: [childSchema]
})

module.exports = mongoose.model('Plan', planSchema);