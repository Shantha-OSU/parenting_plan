const express = require('express');
const { PDFDocument, StandardFonts } = require('pdf-lib');
const verifyToken = require('../middleware/verifyToken');
const { assertFormId, fillOfficialForm, toAnswerMap } = require('../services/officialFormService');

const router = express.Router();

async function getAuthorizedPlan(planId, uid) {
  const Plan = require('../models/Plan');
  const Case = require('../models/Case');
  const plan = await Plan.findById(planId).lean();
  if (!plan) return null;
  if (plan.userID === uid) return plan;
  if (!plan.caseId) return null;
  const parentingCase = await Case.findOne({
    _id: plan.caseId,
    $or: [{ parent1Uid: uid }, { parent2Uid: uid }],
  }).lean();
  return parentingCase ? plan : null;
}

function getFinalAnswers(plan, parentingCase) {
  if (parentingCase?.status === 'resolved' && Array.isArray(parentingCase.mergedAnswers)) {
    return toAnswerMap(parentingCase.mergedAnswers);
  }
  if (parentingCase) {
    const error = new Error('The shared case does not have final agreed answers');
    error.status = 409;
    throw error;
  }
  const answers = toAnswerMap(plan.answers);
  for (const [section, value] of [
    ['parentingTimeAndCommunication', plan.parentingTimeAndCommunication],
    ['informationSharing', plan.informationSharing],
    ['taxExemptions', plan.taxExemptions],
  ]) {
    if (!value || typeof value !== 'object') continue;
    for (const [key, answer] of Object.entries(value)) {
      answers[`${section}.${key}`] = answer;
    }
  }
  for (const key of [
    'parentFName', 'parentLName', 'userRole', 'currentCircumstance',
    'caseFilingStatus', 'courtCustodyOrderIssued', 'custodyGrantedTo', 'children',
  ]) {
    if (plan[key] !== undefined) answers[key] = plan[key];
  }
  return answers;
}

async function render(planId, formId, uid, flatten) {
  const Plan = require('../models/Plan');
  const Case = require('../models/Case');
  const OfficialFormVersion = require('../models/OfficialFormVersion');
  const OfficialFormMapping = require('../models/OfficialFormMapping');
  assertFormId(formId);
  const plan = await getAuthorizedPlan(planId, uid);
  if (!plan) {
    const error = new Error('Forbidden');
    error.status = 403;
    throw error;
  }
  const parentingCase = plan.caseId ? await Case.findById(plan.caseId).lean() : null;
  const version = await OfficialFormVersion.findOne({ formId, status: 'active' }).select('+pdfData');
  if (!version) {
    const error = new Error('No active official form version');
    error.status = 404;
    throw error;
  }
  const mapping = await OfficialFormMapping.findOne({ versionId: version._id });
  if (!mapping) {
    const error = new Error('No mapping exists for the active official form version');
    error.status = 409;
    throw error;
  }
  const result = await fillOfficialForm(version, mapping, getFinalAnswers(plan, parentingCase), { flatten });
  return { ...result, version };
}

router.post('/plan/:planId/official-form/:formId', verifyToken, async (req, res) => {
  try {
    const result = await render(req.params.planId, req.params.formId, req.user.uid, req.body?.flatten !== false);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${req.params.formId}.pdf"`,
      'X-Official-Form-Version-Id': String(result.version._id),
      'X-Official-Form-Revision': result.version.revisionLabel,
      'X-Official-Form-Report': JSON.stringify({ needsAttention: result.attention }),
    });
    return res.send(Buffer.from(result.bytes));
  } catch (error) {
    console.error('Could not generate official form:', error);
    return res.status(error.status || 400).json({ error: error.message });
  }
});

router.post('/plan/:planId/official-form/:formId/packet', verifyToken, async (req, res) => {
  try {
    const result = await render(req.params.planId, req.params.formId, req.user.uid, true);
    const schedule = await PDFDocument.create();
    const page = schedule.addPage();
    const font = await schedule.embedFont(StandardFonts.Helvetica);
    const Plan = require('../models/Plan');
    const plan = await Plan.findById(req.params.planId).lean();
    const scheduleData = plan?.parentingTimeAndCommunication || {};
    page.drawText('Parenting-Time Schedule Attachment', { x: 54, y: 740, size: 16, font });
    page.drawText(JSON.stringify(scheduleData, null, 2).slice(0, 5000), {
      x: 54, y: 710, size: 9, font, maxWidth: 500, lineHeight: 12,
    });
    const packet = await PDFDocument.load(result.bytes);
    const attachment = await PDFDocument.load(await schedule.save());
    const copied = await packet.copyPages(attachment, attachment.getPageIndices());
    copied.forEach((copiedPage) => packet.addPage(copiedPage));
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${req.params.formId}-packet.pdf"`,
      'X-Official-Form-Version-Id': String(result.version._id),
      'X-Official-Form-Report': JSON.stringify({
        needsAttention: result.attention,
        childSupportWorksheet: 'not included',
      }),
    });
    return res.send(Buffer.from(await packet.save()));
  } catch (error) {
    console.error('Could not generate official form packet:', error);
    return res.status(error.status || 400).json({ error: error.message });
  }
});

module.exports = router;
