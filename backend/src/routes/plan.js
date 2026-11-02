const express = require('express');
const router = express.Router();
const Plan = require('../models/Plan');
const Case = require('../models/Case');
const Question = require('../models/Question');
const User = require('../models/User');
const verifyToken = require('../middleware/verifyToken');
const { getFirstName } = require('../utils/nameUtils');

// POST /api/plan - Start a new plan
// Optional body: { caseId } — when provided (co-parent accept flow), the new plan
// is linked to the existing Case rather than creating a fresh one.
router.post('/', verifyToken, async (req, res) => {
  try {
    const userID = req.user.uid;
    const { caseId } = req.body || {};

    const plan = await Plan.create({ userID });

    if (caseId) {
      // Co-parent joining an existing case: attach this plan as parent2's plan.
      try {
        const existingCase = await Case.findById(caseId);
        if (existingCase) {
          // Guard: only block if a DIFFERENT user is trying to join.
          // Parent 2 may call this right after accepting the invite, at which point
          // parent2Uid is already set to their own UID — that's valid and should be allowed.
          if (existingCase.parent2Uid && existingCase.parent2Uid !== userID) {
            return res.status(409).json({ error: 'A co-parent has already joined this case' });
          }
          existingCase.parent2Uid = userID;
          existingCase.parent2PlanId = plan._id;
          await existingCase.save();
          const [p1User, p1Plan] = await Promise.all([
            User.findOne({ firebaseUid: existingCase.parent1Uid }, 'name email'),
            Plan.findById(existingCase.parent1PlanId),
          ]);
          plan.name = `Shared Plan with ${getFirstName(p1User)}`;
          plan.caseId = existingCase._id;
          plan.isShared = true;
          plan.isParent2 = true;
          plan.children = p1Plan?.children ?? [];
          plan.collaborationMode = p1Plan?.collaborationMode ?? '';
          const oppositeUserRole = {
            'parent1/petitioner1/plaintiff': 'parent2/petitioner2/defendant',
            'parent2/petitioner2/defendant': 'parent1/petitioner1/plaintiff',
          };
          const oppositeResidentialParent = {
            yes: 'no',
            no: 'yes',
          };
          plan.userRole = oppositeUserRole[p1Plan?.userRole] ?? p1Plan?.userRole ?? '';
          plan.residentialParent = oppositeResidentialParent[p1Plan?.residentialParent] ?? p1Plan?.residentialParent ?? '';
          plan.parentingTimeAndCommunication = {
            parentingSchedule: p1Plan?.parentingTimeAndCommunication?.parentingSchedule ?? {},
          };
          await plan.save();
        }
      } catch (caseErr) {
        console.error('Failed to link plan to existing Case:', caseErr.message);
      }
    } else {
      // Primary parent starting a new plan: auto-create a fresh Case.
      try {
        const parent1Name = [plan.parentFName, plan.parentLName].filter(Boolean).join(' ');
        const newCase = await Case.create({
          parent1Uid: userID,
          parent1PlanId: plan._id,
          ...(parent1Name ? { parent1Name } : {}),
          parent1Address: plan.streetAddress || '',
          parent1City: plan.city || '',
          parent1State: plan.state || '',
          parent1ZipCode: plan.zipCode || '',
        });
        plan.caseId = newCase._id;
        await plan.save();
      } catch (caseErr) {
        console.error('Failed to auto-create Case for plan:', caseErr.message);
      }
    }

    res.status(201).json(plan);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/plan/delete - Delete a plan with the pid specified in request body
router.post('/delete', verifyToken, async (req, res) => {
  try {
    const { pID } = req.body;
    const deletedItem = await Plan.findOneAndDelete({ _id: pID, userID: req.user.uid });
    if (deletedItem) {
      return res.status(200).json({ message: 'Plan deleted successfully' });
    } else {
      return res.status(403).json({ error: 'Forbidden' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/plan/all -> Get all plans owned by the authenticated user
router.get('/all', verifyToken, async (req, res) => {
  try {
    const plans = await Plan.find({ userID: req.user.uid });
    res.status(200).json(plans);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/plan/:uid/all -> Legacy route retained for existing clients
router.get('/:uid/all', verifyToken, async (req, res) => {
  if (req.params.uid !== req.user.uid) return res.status(403).json({ error: 'Forbidden' });
  try {
    const plans = await Plan.find({ userID: req.user.uid });
    res.status(200).json(plans);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// GET /api/plan/:planId/current -> Get the current question for a plan
router.get('/:planId/current', verifyToken, async (req, res) => {
  try {
    // Fetch the plan and replace currentQuestion ID with the full Question document
    const plan = await Plan.findById(req.params.planId).populate('currentQuestion');

    // Reject if plan doesn't exist or belongs to a different user
    if (!plan || plan.userID !== req.user.uid) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // No current question means the plan is finished
    if (!plan.currentQuestion) {
      return res.json({ done: true });
    }

    // Return the full question data for the frontend to render
    res.json({ question: plan.currentQuestion });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/plan/updateCurrent/:planId/:currQId - Update a plan's currentQuestion field to be currQId
router.post('/updateCurrent/:planId/:currQId', verifyToken, async (req, res) => {
  try {
    const { planId, currQId } = req.params;
    const plan = await Plan.findById(planId);
    if (!plan) {
      return res.status(404).json({ message: 'Plan not found'})
    }
    if (plan.userID !== req.user.uid) {
      return res.status(401).json({ message: 'Unauthorized to update this plan' }); 
    }
    plan.currentQuestion = currQId;
    await plan.save()
    return res.status(200).json({ message: 'Plan updated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// Add an answer to the plan
// POST/api/plan/:planId/answer
router.post('/:planId/answer', verifyToken, async (req, res) => {
  try {
    const planID = req.params.planId;
    //Retrieve plan and fetch from Mongo
    const plan = await Plan.findById(planID);

    //If the planId was not found or doesn't belong to the requesting user
    if (!plan || plan.userID !== req.user.uid) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const {qKey, answer} = req.body
    const index = plan.answers.findIndex(userAnswer => userAnswer.qKey === qKey)
    const oldAnswer = plan.answers[index]?.answer
    if (index === -1) {
      // case for first question answered in plan
      plan.answers.push({qKey: qKey, answer: answer})
    } else if (JSON.stringify(oldAnswer) !== JSON.stringify(answer)) {
      // case for changing exsisting response
      plan.answers[index] = {qKey: qKey, answer: answer}
    } else {
      // no change to question required since answer matches
      return res.status(200).json(plan)
    }

    //Save the plan and write back to DB
    await plan.save();
    res.status(201).json(plan);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Save answers from the custom parenting-plan sections.
router.post('/:planId/sections', verifyToken, async (req, res) => {
  try {
    const plan = await Plan.findById(req.params.planId);
    if (!plan || plan.userID !== req.user.uid) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const allowedSections = ['parentingTimeAndCommunication', 'informationSharing', 'taxExemptions'];
    const { section, answers } = req.body;
    if (!allowedSections.includes(section) || !answers || typeof answers !== 'object' || Array.isArray(answers)) {
      return res.status(400).json({ error: 'Invalid section answers' });
    }

    plan[section] = answers;
    await plan.save();
    res.status(200).json(plan);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/plan/prevQuestion/:qkey/:planId - get prev question answered before current question
// returns "none" if there is no previous question
router.get('/prevQuestion/:qkey/:planId', verifyToken, async (req, res) => {
  const qKey = req.params.qkey
  const planId = req.params.planId

  try {
    //Retrieve plan and fetch from Mongo
    const plan = await Plan.findById(planId);

    //If the planId was not found or doesn't belong to the requesting user
    if (!plan || plan.userID !== req.user.uid) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    let index = plan.answers.findIndex(userAnswer => userAnswer.qKey === qKey)
    if (index < 0) {
      // If the current question has not been answered yet, use the most recent answer.
      index = plan.answers.length
    }
    const previousKey = index > 0 ? plan.answers[index - 1].qKey : undefined;

    const prevQuestion = previousKey
      ? await Question.findOne({ qKey: previousKey })
      : "none";
    return res.status(200).json(prevQuestion)
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add children to the plan
// POST/api/plan/:planId/children
router.post('/:planId/children', verifyToken, async (req, res) => {
  try {
    const planID = req.params.planId;
    //Retrieve plan and fetch from Mongo
    const plan = await Plan.findById(planID);

    //If the planId was not found or doesn't belong to the requesting user
    if (!plan || plan.userID !== req.user.uid) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const { planChildren } = req.body
    plan.children = planChildren
    //Save the plan and write back to DB
    await plan.save();
    res.status(201).json(plan);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update phone and address to the plan
// POST/api/plan/:planId/information
router.post('/:planId/information', verifyToken, async (req, res) => {
  try {
    const planID = req.params.planId;
    //Retrieve plan and fetch from Mongo
    const plan = await Plan.findById(planID);

    //If the planId was not found or doesn't belong to the requesting user
    if (!plan || plan.userID !== req.user.uid) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const { parentFName, parentLName, parentAge, phone, streetAddress, addressLine2, city, state, zipCode, aggregateData, userRole, residentialParent} = req.body;
    plan.parentFName = parentFName;
    plan.parentLName = parentLName;
    plan.parentAge = parentAge;
    plan.phoneNumber = phone;
    plan.streetAddress = streetAddress;
    plan.addressLine2 = addressLine2;
    plan.city = city;
    plan.state = state;
    plan.zipCode = zipCode;
    if (aggregateData !== undefined) {
      plan.aggregateData = aggregateData;
    }
    plan.userRole = userRole;
    plan.isParent2 = userRole === 'parent2/petitioner2/defendant';
    plan.residentialParent = residentialParent;
    //Save the plan and write back to DB
    await plan.save();
    if (plan.caseId && typeof Case.findById === 'function') {
      const parentingCase = await Case.findById(plan.caseId);
      if (parentingCase) {
        const parentName = [plan.parentFName, plan.parentLName].filter(Boolean).join(' ');
        if (parentingCase.parent1Uid === req.user.uid) parentingCase.parent1Name = parentName;
        if (parentingCase.parent2Uid === req.user.uid) parentingCase.parent2Name = parentName;
        const addressFields = {
          Address: plan.streetAddress || '',
          City: plan.city || '',
          State: plan.state || '',
          ZipCode: plan.zipCode || '',
        };
        const prefix = parentingCase.parent1Uid === req.user.uid ? 'parent1' : 'parent2';
        Object.entries(addressFields).forEach(([field, value]) => {
          parentingCase[`${prefix}${field}`] = value;
        });
        await parentingCase.save();
      }
    }
    res.status(201).json(plan);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

//Retrieve a plan
// GET/api/plan/:planId
router.get('/:planId', verifyToken, async (req, res) => {
  try {
    const planID = req.params.planId;
    //Retrieve plan and fetch from Mongo
    const plan = await Plan.findById(planID);

    //If the planId was not found or doesn't belong to the requesting user
    if (!plan || plan.userID !== req.user.uid) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    //Send plan back
    res.json(plan);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Set a plan's collaborationMode field
// POST/api/plan/setCollabMode/:planId
router.post('/setCollabMode/:planId', verifyToken, async (req, res) => {
  try {
    const planID = req.params.planId;
    //Retrieve plan and fetch from Mongo
    const plan = await Plan.findById(planID);

    //If the planId was not found or doesn't belong to the requesting user
    if (!plan || plan.userID !== req.user.uid) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const { mode } = req.body
    plan.collaborationMode = mode
    await plan.save()
    res.status(201).json(plan)
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/plan/:planId/name — rename a plan
router.patch('/:planId/name', verifyToken, async (req, res) => {
  try {
    const plan = await Plan.findById(req.params.planId);
    if (!plan || plan.userID !== req.user.uid) return res.status(403).json({ error: 'Forbidden' });
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
    plan.name = name.trim();
    await plan.save();
    res.json({ name: plan.name });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
