import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowUp, GripVertical, Plus, Printer, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { useForm } from '../hooks/useForm';
import { buildApiUrl } from '../lib/apiClient';
import { auth } from '../lib/firebase';
import { CUSTOM_COMPARISON_QUESTIONS } from '../lib/comparisonQuestionDefinitions';
import './Page.css';
import './FormDesigner.css';

const STORAGE_KEY = 'shareCareFormTemplate';
const TEMPLATE_FORMATS = {
  review: {
    label: 'Review PDF',
    title: 'Parenting Plan Questionnaire Responses',
  },
  comparison: {
    label: 'Comparison PDF',
    title: 'Merged Parenting Plan Responses',
  },
};
const WEEK_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SCHEDULE_FIELDS = {
  parentingSchedule: 'Regular Parenting Schedule',
  holidaySchedule: 'Holiday Schedule',
  schoolSchedule: 'School Schedule',
};
const SCHEDULE_QKEYS = Object.keys(SCHEDULE_FIELDS).reduce((keys, field) => ({
  ...keys,
  [field]: `parentingTimeAndCommunication.${field}`,
}), {});
const QUESTION_PAGE_LABELS = {
  'getting-started': 'Getting Started',
  parents: 'Getting Started',
  plan: 'Getting Started',
  'parental-rights': 'Parental Rights',
  'health-insurance-coverage': 'Health Insurance Coverage',
  parentingtimeandcommunication: 'Parenting Time & Communication',
  timeandcommunication: 'Parenting Time & Communication',
  informationsharing: 'Information Sharing',
  taxexemptions: 'Tax Exemptions',
};
const DESIGNER_CUSTOM_QUESTIONS = {
  ...CUSTOM_COMPARISON_QUESTIONS,
  'parentingTimeAndCommunication.parentingSchedule': {
    qText: SCHEDULE_FIELDS.parentingSchedule,
    scheduleType: 'regular',
  },
  'parentingTimeAndCommunication.holidaySchedule': {
    qText: SCHEDULE_FIELDS.holidaySchedule,
    scheduleType: 'calendar',
  },
  'parentingTimeAndCommunication.schoolSchedule': {
    qText: SCHEDULE_FIELDS.schoolSchedule,
    scheduleType: 'calendar',
  },
  'taxExemptions.parentRole': {
    qText: 'Your parental role',
    options: [
      { value: 'residential', label: 'I am the residential parent' },
      { value: 'nonresidential', label: 'I am the non-residential parent' },
    ],
  },
  'taxExemptions.claimingChildren': {
    qText: 'Which children will you claim as tax exemptions?',
  },
  'taxExemptions.childAnswers': {
    qText: 'Tax exemption arrangements for each child',
    childAnswers: true,
  },
};
const CHILD_CLASSIFICATION_LABELS = {
  'under-18': 'Under 18',
  disabled: 'Disabled',
  'emancipated-adult': 'Emancipated adult',
};

function canonicalScheduleKey(qKey) {
  const field = String(qKey || '').split('.').pop();
  return SCHEDULE_QKEYS[field] || qKey;
}

export function answerText(answer, question, answeringParent, relativeLabels = false, pdfLabels = false) {
  if (answer === null || answer === undefined || answer === '') return 'Not answered';
  if (question?.childDetails) {
    return formatChildDetails(answer);
  }
  if (pdfLabels && question?.qKey === 'school_address_parent' && typeof answer === 'string') {
    const parentLabel = answeringParent === 'parent2'
      ? 'Parent 2'
      : answeringParent === 'no_case' ? 'Me' : 'Parent 1';
    const coParentLabel = answeringParent === 'parent2'
      ? 'Parent 1'
      : answeringParent === 'no_case' ? 'Co-parent' : 'Parent 2';
    const labels = {
      me: `${parentLabel === 'Me' ? 'me' : `${parentLabel}'s`} address`,
      coParent: `${coParentLabel === 'Co-parent' ? 'my co-parent\'s' : `${coParentLabel}'s`} address`,
      defaultToCoParent: `Default to ${coParentLabel === 'Co-parent' ? 'my co-parent\'s' : `${coParentLabel}'s`} address`,
      needMoreInfo: 'I need more information',
      parent1: "Parent 1's address",
      parent2: "Parent 2's address",
    };
    return labels[answer] || answer;
  }
  if (question?.childAnswers) {
    const parent1Label = relativeLabels
      ? answeringParent === 'parent2' ? 'My co-parent' : 'I'
      : answeringParent === 'no_case' ? 'I' : 'Parent 1';
    const parent2Label = relativeLabels
      ? answeringParent === 'parent2' ? 'I' : 'My co-parent'
      : answeringParent === 'no_case' ? 'Co-parent' : 'Parent 2';
    const intentLabels = {
      everyYear: 'Claim every year',
      someYears: 'Claim some years',
      defer: 'Defer to co-parent',
      parent1EveryYear: `${parent1Label} will claim every year`,
      parent1SomeYears: parent1Label,
      parent2EveryYear: `${parent2Label} will claim every year`,
      parent2SomeYears: parent2Label,
      parent1: parent1Label,
      parent2: parent2Label,
    };
    const yearLabels = {
      odd: 'Odd-numbered tax years',
      even: 'Even-numbered tax years',
      custom: 'Custom tax years',
    };
    if (!answer || typeof answer !== 'object') return 'Not answered';
    const lines = Object.entries(answer).flatMap(([child, details]) => {
      if (!details || typeof details !== 'object') return [`${child}: ${details}`];
      const arrangement = intentLabels[details.intent] || details.intent || 'No arrangement entered';
      const currentIsParent2 = details.userIsParent2 ?? answeringParent === 'parent2';
      const currentParent = currentIsParent2 ? parent2Label : parent1Label;
      const coParent = currentIsParent2 ? parent1Label : parent2Label;
      const explicitClaimant = details.claimantParent
        || details.taxYearParent
        || (details.intent?.startsWith('parent1') ? 'parent1' : null)
        || (details.intent?.startsWith('parent2') ? 'parent2' : null);
      const claimantParent = explicitClaimant === 'parent1'
        ? parent1Label
        : explicitClaimant === 'parent2'
          ? parent2Label
          : currentParent;
      const otherParentNumber = claimantParent === parent1Label ? parent2Label : parent1Label;
      const years = details.taxYears === 'custom'
        ? `${claimantParent} will claim: ${details.customYears || 'Not entered'}; ${otherParentNumber} will claim: ${details.coParentCustomYears || 'Not entered'}`
        : details.taxYears === 'odd'
          ? `${claimantParent} will claim: Odd-numbered tax years; ${otherParentNumber} will claim: Even-numbered tax years`
          : details.taxYears === 'even'
            ? `${claimantParent} will claim: Even-numbered tax years; ${otherParentNumber} will claim: Odd-numbered tax years`
        : yearLabels[details.taxYears] || details.taxYears;
      const isSomeYearsArrangement = ['parent1SomeYears', 'parent2SomeYears', 'someYears'].includes(details.intent);
      return [`${child}: ${[isSomeYearsArrangement ? '' : arrangement, years].filter(Boolean).join(' — ')}`];
    });
    return lines.length ? lines.join('\n') : 'No child arrangements entered';
  }
  if (question?.scheduleType) {
    return formatSchedule(answer, question.scheduleType);
  }
  const value = (item) => {
    const label = question?.options?.find((option) => option.value === item)?.label || String(item);
    if (!answeringParent) return label;
    const parent = answeringParent === 'parent2' ? 'Parent 2'
      : answeringParent === 'no_case' ? 'Myself' : 'Parent 1';
    const coParent = answeringParent === 'parent2' ? 'Parent 1'
      : answeringParent === 'no_case' ? 'Co-parent' : 'Parent 2';
    return label
      .replace(/\bMe and my co-parent\b/g, `${parent} and ${coParent}`)
      .replace(/\bMe and my coparent\b/g, `${parent} and ${coParent}`)
      .replace(/\bJust me\b/g, parent)
      .replace(/\bJust my co-parent(?:'s)?\b/g, coParent)
      .replace(/\bmy co-parent\b/gi, coParent)
      .replace(/\bme\b/gi, parent)
      .replace(/\bcoparent\b/gi, coParent)
      .replace(/\bmine\b/gi, parent + "'s");
  };
  return Array.isArray(answer) ? answer.map(value).join(', ') : value(answer);
}

function formatTime(time) {
  if (!time) return '';
  const [hours, minutes] = time.split(':').map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return time;
  return `${hours % 12 || 12}:${String(minutes).padStart(2, '0')} ${hours >= 12 ? 'PM' : 'AM'}`;
}

function formatBirthday(birthday) {
  if (!birthday) return 'Birthday not entered';
  const date = new Date(`${birthday}T00:00:00`);
  if (Number.isNaN(date.getTime())) return String(birthday);
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatChildDetails(children) {
  if (!Array.isArray(children) || !children.length) return 'No children entered';
  return children.map((child, index) => {
    const name = [child?.fName ?? child?.firstName, child?.lName ?? child?.lastName]
      .filter(Boolean)
      .join(' ') || `Child ${index + 1}`;
    const classifications = Array.isArray(child?.classifications)
      ? child.classifications.map((classification) => (
        CHILD_CLASSIFICATION_LABELS[classification] || classification
      ))
      : [];
    const details = [
      `Birthday: ${formatBirthday(child?.birthday)}`,
      `Classification: ${classifications.length ? classifications.join(', ') : 'None entered'}`,
    ];
    return `${name}\n${details.join('\n')}`;
  }).join('\n\n');
}

function formatScheduleSlot(slot) {
  if (!slot || typeof slot !== 'object') return '';
  if (slot.wholeDay) return 'All day';
  const start = formatTime(slot.startTime);
  const end = formatTime(slot.endTime);
  return start && end ? `${start}–${end}` : start || end;
}

function formatCalendarDetails(details) {
  if (!details || typeof details !== 'object') return 'No preference entered';
  if (details.doesNotApply) return 'Does not apply';
  const yearLabels = {
    odd: 'Odd years',
    even: 'Even years',
    every: 'Every year',
  };
  const parts = [
    yearLabels[details.year] || details.year,
    formatTime(details.time),
    details.alternativeRequest,
  ].filter(Boolean);
  return parts.join(' · ') || 'No preference entered';
}

function formatSchedule(answer, scheduleType) {
  if (!answer || typeof answer !== 'object') return 'Not scheduled';
  const entries = Object.entries(answer);
  if (!entries.length) return 'Not scheduled';

  if (scheduleType === 'regular') {
    const lines = entries.flatMap(([dayIndex, slots]) => {
      if (!Array.isArray(slots) || !slots.length) return [];
      const index = Number(dayIndex);
      const week = Math.floor(index / 7) + 1;
      const day = WEEK_DAYS[index % 7] || `Day ${dayIndex}`;
      return slots.map((slot) => {
        const parent = slot?.parent ? ` (${slot.parent === 'parent1' ? 'Parent 1' : 'Parent 2'})` : '';
        return `Week ${week}, ${day}: ${formatScheduleSlot(slot) || 'No time set'}${parent}`;
      });
    });
    return lines.length ? lines.join('\n') : 'Not scheduled';
  }

  const lines = entries.map(([name, details]) => {
    if (!details || typeof details !== 'object') return `${name}: ${details}`;
    if (details.doesNotApply) return `${name}: Does not apply`;
    return `${name}: ${formatCalendarDetails(details)}`;
  });
  return lines.join('\n');
}

function ScheduleCalendar({ schedule = {} }) {
  const safeSchedule = schedule && typeof schedule === 'object' ? schedule : {};
  const hasSlots = Object.values(safeSchedule).some((slots) => Array.isArray(slots) && slots.length);
  if (!hasSlots) return <span>Not scheduled</span>;

  return (
    <div className="form-designer__schedule-calendar" aria-label="Regular parenting schedule calendar">
      <div className="form-designer__schedule-weekday-header">
        <span />
        {WEEK_DAYS.map((day) => <span key={day}>{day.slice(0, 3)}</span>)}
      </div>
      {[0, 1, 2, 3].map((week) => (
        <div className="form-designer__schedule-week-row" key={week}>
          <span className="form-designer__schedule-week-label">Week {week + 1}</span>
          {WEEK_DAYS.map((day, dayOfWeek) => {
            const dayIndex = week * 7 + dayOfWeek;
            const slots = Array.isArray(safeSchedule[dayIndex]) ? safeSchedule[dayIndex] : [];
            return (
              <div
                className={`form-designer__schedule-day-cell${slots.length ? ' form-designer__schedule-day-cell--assigned' : ''}`}
                key={day}
              >
                {slots.map((slot, index) => (
                  <div
                    className={`form-designer__schedule-slot form-designer__schedule-slot--${slot.parent || 'parent1'}`}
                    key={`${dayIndex}-${index}`}
                  >
                    <span className="form-designer__schedule-slot-parent">
                      {slot.parent === 'parent2' ? 'Parent 2' : 'Parent 1'}
                    </span>
                    <span>{formatScheduleSlot(slot) || 'No time set'}</span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function ComparisonSchedule({ value, type }) {
  const parent1 = value?.parent1 && typeof value.parent1 === 'object' ? value.parent1 : {};
  const parent2 = value?.parent2 && typeof value.parent2 === 'object' ? value.parent2 : {};
  if (type === 'regular') {
    const schedule = {};
    [parent1, parent2].forEach((source, parentIndex) => {
      Object.entries(source).forEach(([day, slots]) => {
        if (!Array.isArray(slots)) return;
        schedule[day] = [
          ...(schedule[day] || []),
          ...slots.map((slot) => ({ ...slot, parent: `parent${parentIndex + 1}` })),
        ];
      });
    });
    return <ScheduleCalendar schedule={schedule} />;
  }
  const names = [...new Set([...Object.keys(parent1), ...Object.keys(parent2)])];
  return (
    <div className="form-designer__comparison-schedule">
      {names.map((name) => (
        <div className="form-designer__comparison-schedule-row" key={name}>
          <strong>{name}</strong>
          <span className="form-designer__comparison-schedule-box">
            <strong>Parent 1</strong> {formatCalendarDetails(parent1[name])}
          </span>
          <span className="form-designer__comparison-schedule-box">
            <strong>Parent 2</strong> {formatCalendarDetails(parent2[name])}
          </span>
        </div>
      ))}
    </div>
  );
}

function scheduleTypeForKey(qKey) {
  const field = String(qKey || '').split('.').pop();
  return field === 'parentingSchedule' ? 'regular'
    : field === 'holidaySchedule' || field === 'schoolSchedule' ? 'calendar'
      : null;
}

function renderScheduleAnswer(qKey, answer, question) {
  const scheduleType = scheduleTypeForKey(qKey) || question?.scheduleType;
  if (!scheduleType) return null;
  if (answer?.parent1 || answer?.parent2) {
    return <ComparisonSchedule value={answer} type={scheduleType} />;
  }
  if (scheduleType === 'regular') return <ScheduleCalendar schedule={answer} />;
  return (
    <div className="form-designer__comparison-schedule">
      {Object.entries(answer || {}).map(([name, details]) => (
        <div className="form-designer__comparison-schedule-row" key={name}>
          <strong>{name}</strong>
          <span className="form-designer__comparison-schedule-box">{formatCalendarDetails(details)}</span>
        </div>
      ))}
    </div>
  );
}

function hasAnswer(answer) {
  if (answer === null || answer === undefined || answer === '') return false;
  if (Array.isArray(answer)) return answer.length > 0 && answer.some(hasAnswer);
  if (typeof answer === 'object') return Object.values(answer).some(hasAnswer);
  return true;
}

const INTERNAL_FORM_FIELDS = new Set([
  'caseid',
  'planid',
  'isshared',
  'ownerid',
  'userid',
  '_id',
  'createdat',
  'updatedat',
  '__v',
  'status',
  'currentquestion',
  'aggregatedata',
  'collaborationmode',
  'children',
  'taxexemptions',
  'parentingtimeandcommunication',
  'informationsharing',
  'errors',
  'responses',
  'answers',
]);

function isInternalFormField(key) {
  return INTERNAL_FORM_FIELDS.has(String(key).toLowerCase());
}

function questionPageLabel(question) {
  if (question.section) {
    const sectionKey = String(question.section).toLowerCase();
    return QUESTION_PAGE_LABELS[sectionKey] || question.section;
  }
  const prefix = String(question.qKey || '').split('.')[0].toLowerCase();
  return QUESTION_PAGE_LABELS[prefix] || 'Other questions';
}

function shouldShowQuestionLabel(question) {
  const section = String(question.section || String(question.qKey || '').split('.')[0]).toLowerCase();
  return section === 'parental-rights'
    || section === 'health-insurance-coverage'
    || section === 'informationsharing';
}

function questionLabel(question) {
  return question.qTitle || question.label || question.qKey;
}

function questionDisplayText(question) {
  return question.qText || question.qTitle || question.label || question.qKey;
}

function createToken(response, question) {
  return {
    id: `${response.qKey}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    type: 'answer',
    qKey: response.qKey,
    questionText: questionDisplayText(question || response),
    section: response.section || '',
  };
}

function createQuestionToken(question) {
  return {
    id: `${question.qKey}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    type: 'answer',
    qKey: question.qKey,
    questionText: questionDisplayText(question),
    section: question.section || 'Questionnaire',
  };
}

const customFieldLabels = {
  agreeToTransportationPolicy: 'Agree to the standard transportation policy',
  transportationArrangementDescription: 'Preferred transportation arrangement',
  agreeToActivityPolicy: 'Agree to the standard activity policy',
  activityPolicyDescription: 'Preferred activity policy',
  communicationWithCoParentOnPhone: 'Phone communication with co-parent',
  communicationWithCoParentOnPhoneDescription: 'Phone communication circumstances',
  notifyCoParentOfChildRelatedEvents: 'Notify co-parent about illness or injury',
  notifyCoParentOfChildRelatedEventsDescription: 'Illness or injury notification circumstances',
  medicalRecords: 'Medical information access',
  schoolContact: 'School contact rights',
  schoolActivities: 'School activity participation',
};

const customOptionValues = {
  agreeToTransportationPolicy: {
    true: 'I agree to the standard transportation policy',
    false: 'I do not agree with the standard transportation policy',
  },
  agreeToActivityPolicy: {
    true: 'I agree to the standard activity policy',
    false: 'I do not agree with the standard activity policy',
  },
  communicationWithCoParentOnPhone: {
    yes: 'Yes',
    no: 'No',
    sometimes: 'Sometimes (please describe)',
    needMoreInfo: 'I need more information',
    defaultToCoParentChoice: "Default to my co-parent's choice",
  },
  notifyCoParentOfChildRelatedEvents: {
    yes: 'Yes',
    no: 'No',
    sometimes: 'Sometimes (please describe)',
    needMoreInfo: 'I need more information',
    defaultToCoParentChoice: "Default to my co-parent's choice",
  },
  medicalRecords: {
    parent1: 'Just me',
    parent2: 'Just my co-parent',
    both: 'Both me and my co-parent',
    needInfo: 'I need more information',
    defer: "Default to my co-parent's choice",
  },
  schoolContact: {
    parent1: 'Just me',
    parent2: 'Just my co-parent',
    both: 'Both me and my co-parent',
    needInfo: 'I need more information',
    defer: "Default to my co-parent's choice",
  },
  schoolActivities: {
    parent1: 'Just me',
    parent2: 'Just my co-parent',
    both: 'Both me and my co-parent',
    needInfo: 'I need more information',
    defer: "Default to my co-parent's choice",
  },
};

const FLAG_KEY_ALIASES = {
  'personalInfo.userRole': 'caseFilingStatus',
  'getting-started.children': 'children',
  'taxExemptions.parentRole': 'taxParentalRole',
  'taxExemptions.claimingChildren': 'taxClaimingChildren',
  'parentingTimeAndCommunication.agreeToTransportationPolicy': 'transportationAgreement',
  'parentingTimeAndCommunication.agreeToActivityPolicy': 'activitiesAndScheduling',
};

function isAnswerFlagged(qKey, flags = {}) {
  const field = String(qKey).split('.').pop();
  return Boolean(
    flags[qKey] ||
    flags[`question-${qKey}`] ||
    flags[field] ||
    flags[FLAG_KEY_ALIASES[qKey]],
  );
}

export function collectAnswers(state, questions, caseParentNames = {}) {
  const flags = state.flags ?? {};
  const responses = (Array.isArray(state.plan?.answers) ? state.plan.answers : [])
    .filter((response) => (
      response &&
      !isInternalFormField(String(response.qKey || '').split('.').pop()) &&
      !SCHEDULE_QKEYS[String(response.qKey || '').split('.').pop()]
    ))
    .map((response) => ({
    ...response,
    isFlagged: Boolean(response.isFlagged || isAnswerFlagged(response.qKey, flags)),
    section: questions[response.qKey]?.section || 'Questionnaire',
    }));

  const addFields = (
    source,
    section,
    fields = {},
    questionSection = section,
    personalInfo = false,
    includeEmpty = false,
  ) => {
    Object.entries(fields).forEach(([key]) => {
      const answer = source?.[key];
      if (
        isInternalFormField(key) ||
        key === 'childAnswers' ||
        SCHEDULE_FIELDS[key] ||
        (!includeEmpty && (
          answer === '' ||
          answer === null ||
          answer === undefined
        ))
      ) return;
      const valueMap = customOptionValues[key];
      const options = valueMap
        ? Object.entries(valueMap).map(([value, label]) => ({
          value: value === 'true' ? true : value === 'false' ? false : value,
          label,
        }))
        : [];
      responses.push({
        qKey: `${questionSection}.${key}`,
        answer,
        isFlagged: isAnswerFlagged(`${questionSection}.${key}`, flags),
        section,
        personalInfo,
        label: fields[key] || customFieldLabels[key] || key,
        question: { options },
      });
    });
  };

  const personalInfo = {
    firstName: state.plan?.parentFName,
    lastName: state.plan?.parentLName,
    age: state.plan?.parentAge,
    phone: state.plan?.phoneNumber,
    streetAddress: state.plan?.streetAddress,
    addressLine2: state.plan?.addressLine2,
    city: state.plan?.city,
    state: state.plan?.state,
    zipCode: state.plan?.zipCode,
    ...(state.parents || {}),
  };
  addFields(personalInfo, 'Getting Started', {
    firstName: 'Your first name',
    lastName: 'Your last name',
    age: 'Your age',
    phone: 'Your phone number',
    streetAddress: 'Street address',
    addressLine2: 'Address line 2',
    city: 'City',
    state: 'State',
    zipCode: 'ZIP code',
  }, 'personalInfo', true, true);
  addFields(caseParentNames, 'Personal info', {
    parent1Name: 'Parent 1 name',
    parent2Name: 'Parent 2 name',
    parent1Address: 'Parent 1 street address',
    parent1City: 'Parent 1 city',
    parent1State: 'Parent 1 state',
    parent1ZipCode: 'Parent 1 ZIP code',
    parent2Address: 'Parent 2 street address',
    parent2City: 'Parent 2 city',
    parent2State: 'Parent 2 state',
    parent2ZipCode: 'Parent 2 ZIP code',
  }, 'case', true, true, true);
  addFields(state.plan, 'Getting Started', {
    userRole: 'Case filing status',
    residentialParent: 'Residential parent',
  });
  const parentingTimeData = {
    ...(state.timeAndCommunication || {}),
    ...(state.plan?.timeAndCommunication || {}),
    ...(state.plan?.parentingTime || {}),
    ...(state.plan?.parentingTimeAndCommunication || {}),
  };
  addFields(
    parentingTimeData,
    'Parenting Time & Communication',
    {
      agreeToTransportationPolicy: customFieldLabels.agreeToTransportationPolicy,
      transportationArrangementDescription: customFieldLabels.transportationArrangementDescription,
      agreeToActivityPolicy: customFieldLabels.agreeToActivityPolicy,
      activityPolicyDescription: customFieldLabels.activityPolicyDescription,
      communicationWithCoParentOnPhone: customFieldLabels.communicationWithCoParentOnPhone,
      communicationWithCoParentOnPhoneDescription: customFieldLabels.communicationWithCoParentOnPhoneDescription,
      notifyCoParentOfChildRelatedEvents: customFieldLabels.notifyCoParentOfChildRelatedEvents,
      notifyCoParentOfChildRelatedEventsDescription: customFieldLabels.notifyCoParentOfChildRelatedEventsDescription,
    },
    'parentingTimeAndCommunication',
  );
  addFields(
    state.plan?.informationSharing,
    'Information Sharing',
    {
      medicalRecords: customFieldLabels.medicalRecords,
      schoolContact: customFieldLabels.schoolContact,
      schoolActivities: customFieldLabels.schoolActivities,
    },
    'informationSharing',
  );
  addFields(state.taxExemptions, 'Tax Exemptions', {
    parentRole: 'Parental role',
  }, 'taxExemptions');
  if (state.taxExemptions?.childAnswers && Object.keys(state.taxExemptions.childAnswers).length) {
    responses.push({
      qKey: 'taxExemptions.childAnswers',
      answer: Object.fromEntries(
        Object.entries(state.taxExemptions.childAnswers).map(([name, details]) => [
          name,
          { ...details, userIsParent2: state.plan?.isParent2 === true },
        ]),
      ),
      isFlagged: isAnswerFlagged('taxExemptions.childAnswers', flags),
      section: 'Tax Exemptions',
      label: 'Tax exemption arrangements for each child',
      question: DESIGNER_CUSTOM_QUESTIONS['taxExemptions.childAnswers'],
    });
  }

  const scheduleData = {
    ...(state.timeAndCommunication || {}),
    ...(state.plan?.timeAndCommunication || {}),
    ...(state.plan?.parentingTime || {}),
    ...(state.plan?.parentingTimeAndCommunication || {}),
  };
  Object.entries(SCHEDULE_FIELDS).forEach(([field, label]) => {
    const answer = scheduleData[field];
    if (!answer || typeof answer !== 'object' || !Object.keys(answer).length) return;
    responses.push({
      qKey: `parentingTimeAndCommunication.${field}`,
      answer,
      isFlagged: isAnswerFlagged(`parentingTimeAndCommunication.${field}`, flags),
      section: 'Parenting Time & Communication',
      label,
      question: {
        qText: label,
        scheduleType: field === 'parentingSchedule' ? 'regular' : 'calendar',
      },
    });
  });

  const children = (state.plan?.children || []).map((child, index) =>
    child,
  );
  if (children.length) {
    responses.push({
      qKey: 'getting-started.children',
      answer: children,
      isFlagged: isAnswerFlagged('getting-started.children', flags),
      section: 'Getting Started',
      personalInfo: true,
      label: 'Children',
      question: { qText: 'Children', childDetails: true },
    });
  }

  return responses;
}

function defaultTemplate(format) {
  return {
    title: TEMPLATE_FORMATS[format].title,
    layout: 'blank',
    blocks: [{ id: 'intro', type: 'heading', text: 'Questionnaire Responses' }],
  };
}

export function templateStorageKey(format) {
  return `${STORAGE_KEY}:${format}`;
}

function normalizeTemplate(saved, format) {
  const fallback = defaultTemplate(format);
  if (!saved || !Array.isArray(saved.blocks)) return fallback;

  return {
    ...fallback,
    ...saved,
    title: typeof saved.title === 'string' ? saved.title : fallback.title,
    layout: 'blank',
    blocks: saved.blocks
      .map((block) => (
        block && SCHEDULE_QKEYS[String(block.qKey || '').split('.').pop()]
          ? { ...block, qKey: canonicalScheduleKey(block.qKey) }
          : block
      ))
      .filter((block) => (
      block &&
      typeof block.id === 'string' &&
      ['heading', 'text', 'answer'].includes(block.type)
      ))
      .filter((block, index, blocks) => (
        !blocks.some((other, otherIndex) => (
          otherIndex < index && other.qKey && other.qKey === block.qKey
        ))
      )),
  };
}

export function loadTemplate(format) {
  try {
    const saved = JSON.parse(
      localStorage.getItem(templateStorageKey(format)) ||
      (format === 'review' ? localStorage.getItem(STORAGE_KEY) : null),
    );
    return normalizeTemplate(saved, format);
  } catch {
    return defaultTemplate(format);
  }
}

export function standardTemplate(format, answersByKey, questions) {
  const blocks = [
    { id: 'intro', type: 'heading', text: 'Questionnaire Responses' },
    ...Object.values(answersByKey)
      .filter((response) => response?.qKey)
      .map((response) => ({
        id: `answer-${response.qKey}`,
        type: 'answer',
        qKey: response.qKey,
        questionText: response.label
          || questions[response.qKey]?.qText
          || response.question?.qText
          || response.qKey,
      })),
  ];

  return {
    title: TEMPLATE_FORMATS[format].title,
    layout: 'blank',
    blocks,
  };
}

export async function fetchStandardTemplate(format) {
  const user = auth.currentUser || await new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      unsubscribe();
      resolve(currentUser);
    });
  });
  if (!user) return null;
  const idToken = await user.getIdToken();
  const response = await fetch(buildApiUrl(`/api/form-templates/${format}`), {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (!response.ok) throw new Error('Failed to load standard form template');
  return response.json();
}

export function FormTemplatePrintDocument({
  template,
  answersByKey,
  questions,
  needsDiscussionKeys,
  parentNames = { parent1: 'Parent 1', parent2: 'Parent 2' },
  answeringParent = null,
  showUnanswered = false,
}) {
  return (
    <div className="form-designer__template-print form-designer__canvas form-designer__canvas--blank">
      <div className="form-designer__print-title">{template.title}</div>
      {template.blocks.map((block) => {
        const response = answersByKey[block.qKey] || (showUnanswered ? { answer: null } : null);
        const question = questions[block.qKey] || response?.question;
        if (block.type === 'heading') {
          return (
            <div className="form-designer__block form-designer__block--heading" key={block.id}>
              <div className="form-designer__print-text">{block.text}</div>
            </div>
          );
        }
        if (block.type === 'text') {
          return (
            <div className="form-designer__block form-designer__block--text" key={block.id}>
              <div className="form-designer__print-text">{block.text}</div>
            </div>
          );
        }
        if (!response || (!showUnanswered && !hasAnswer(response.answer))) return null;
        return (
          <div className="form-designer__block form-designer__block--answer" key={block.id}>
            {response.isFlagged && (
              <div className="form-designer__flagged-notice">Flagged</div>
            )}
            {needsDiscussionKeys?.has(block.qKey) && (
              <div className="form-designer__discussion-notice">Needs discussion</div>
            )}
            <div className="form-designer__print-text">{block.questionText}</div>
            {needsDiscussionKeys?.has(block.qKey) && response.parentAnswers ? (
              <div className="form-designer__discussion-answers">
                {['parent1', 'parent2'].map((parent) => (
                  <div className="form-designer__discussion-answer" key={parent}>
                    <strong>{parentNames[parent]}'s answer</strong>
                    <div className="form-designer__answer-value">
                      {renderScheduleAnswer(block.qKey, response.parentAnswers[parent], question)
                        || answerText(response.parentAnswers[parent], question, parent, false, true)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="form-designer__answer-value">
                {renderScheduleAnswer(block.qKey, response.answer, question)
                  || answerText(response.answer, question, response.answerOwner || answeringParent, false, true)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function FormDesigner() {
  const { state } = useForm();
  const navigate = useNavigate();
  const [questions, setQuestions] = useState({});
  const [selectedFormat, setSelectedFormat] = useState('review');
  const [template, setTemplate] = useState(() => loadTemplate('review'));
  const [caseParentNames, setCaseParentNames] = useState({});
  const [isPrinting, setIsPrinting] = useState(false);
  const [standardStatus, setStandardStatus] = useState('');
  const [seededFormats, setSeededFormats] = useState(() => ({
    review: Boolean(localStorage.getItem(templateStorageKey('review')) || localStorage.getItem(STORAGE_KEY)),
    comparison: Boolean(localStorage.getItem(templateStorageKey('comparison'))),
  }));
  const [draggedToken, setDraggedToken] = useState(null);
  const [selectedPalettePage, setSelectedPalettePage] = useState('Getting Started');
  const [questionSearch, setQuestionSearch] = useState('');
  const [canvasPage, setCanvasPage] = useState(0);

  const changeFormat = (event) => {
    const format = event.target.value;
    setSelectedFormat(format);
    setTemplate(loadTemplate(format));
    setCanvasPage(0);
    setSeededFormats((current) => ({
      ...current,
      [format]: Boolean(localStorage.getItem(templateStorageKey(format))),
    }));
  };

  useEffect(() => {
    if (!isPrinting) return undefined;

    const handleAfterPrint = () => setIsPrinting(false);
    window.addEventListener('afterprint', handleAfterPrint);
    const printFrame = window.requestAnimationFrame(() => {
      window.print();
    });

    return () => {
      window.cancelAnimationFrame(printFrame);
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, [isPrinting]);

  useEffect(() => {
    const caseId = state.plan?.caseId;
    if (!caseId) {
      setCaseParentNames({});
      return undefined;
    }

    let active = true;
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user || !active) return;
      try {
        const idToken = await user.getIdToken();
        const response = await fetch(buildApiUrl(`/api/v1/cases/${caseId}/status`), {
          headers: { Authorization: `Bearer ${idToken}` },
        });
        if (!response.ok) throw new Error('Failed to load case parent names');
        const data = await response.json();
        if (active) {
          setCaseParentNames({
            parent1Name: data.parent1Name || '',
            parent2Name: data.parent2Name || '',
            parent1Address: data.parent1Address || '',
            parent1City: data.parent1City || '',
            parent1State: data.parent1State || '',
            parent1ZipCode: data.parent1ZipCode || '',
            parent2Address: data.parent2Address || '',
            parent2City: data.parent2City || '',
            parent2State: data.parent2State || '',
            parent2ZipCode: data.parent2ZipCode || '',
          });
        }
      } catch (error) {
        if (active) {
          setCaseParentNames({});
          console.error(error.message);
        }
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [state.plan?.caseId]);

  useEffect(() => {
    fetch(buildApiUrl('/api/logic-engine/questions'))
      .then((response) => {
        if (!response.ok) throw new Error('Failed to load question definitions');
        return response.json();
      })
      .then((items) => {
        const questionList = Array.isArray(items) ? items : items?.questions;
        if (!Array.isArray(questionList)) throw new Error('Question definitions were not returned as a list');
        const validQuestions = questionList.filter((question) => question?.qKey);
        const mergedQuestions = Object.fromEntries([
          ...validQuestions.map((question) => [question.qKey, question]),
          ...Object.entries(DESIGNER_CUSTOM_QUESTIONS).map(([qKey, question]) => [
            qKey,
            { ...question, qKey },
          ]),
        ]);
        setQuestions(mergedQuestions);
        if (!seededFormats[selectedFormat]) {
          setTemplate((current) => ({
            ...current,
            blocks: [
              ...current.blocks,
              ...Object.values(mergedQuestions)
                .map(createQuestionToken),
            ],
          }));
          setSeededFormats((current) => ({ ...current, [selectedFormat]: true }));
        }
      })
      .catch((error) => console.error(error.message));
  }, [selectedFormat, seededFormats]);

  useEffect(() => {
    localStorage.setItem(templateStorageKey(selectedFormat), JSON.stringify(template));
    if (selectedFormat === 'review') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(template));
    }
  }, [selectedFormat, template]);

  const allAnswers = useMemo(
    () => collectAnswers(state, questions, caseParentNames),
    [state, questions, caseParentNames],
  );
  const currentAnswersByKey = useMemo(
    () => Object.fromEntries(allAnswers.map((response) => [response.qKey, response])),
    [allAnswers],
  );
  const availableAnswers = useMemo(
    () => allAnswers.filter((response) => (
      response.personalInfo
    )),
    [allAnswers],
  );
  const availableQuestions = useMemo(
    () => Object.values(questions).filter((question) => (
      !template.blocks.some((block) => block.qKey === question.qKey)
    )),
    [questions, template.blocks],
  );
  const filteredQuestions = useMemo(() => {
    const search = questionSearch.trim().toLowerCase();
    if (!search) return availableQuestions;
    return availableQuestions.filter((question) => [
      questionLabel(question),
      questionDisplayText(question),
      question.qKey,
    ].some((value) => String(value || '').toLowerCase().includes(search)));
  }, [availableQuestions, questionSearch]);
  const questionGroups = useMemo(() => {
    const groups = new Map();
    filteredQuestions.forEach((question) => {
      const label = questionPageLabel(question);
      if (!groups.has(label)) groups.set(label, []);
      groups.get(label).push(question);
    });
    return [...groups.entries()];
  }, [filteredQuestions]);
  const palettePages = useMemo(
    () => [...questionGroups.map(([page]) => page), 'Personal info'],
    [questionGroups],
  );

  useEffect(() => {
    if (!palettePages.includes(selectedPalettePage)) {
      setSelectedPalettePage(palettePages[0] || 'Personal info');
    }
  }, [palettePages, selectedPalettePage]);

  const selectedQuestionGroup = questionGroups.find(([page]) => page === selectedPalettePage);

  const addBlock = (block) => setTemplate((current) => ({
    ...current,
    blocks: [...current.blocks, block],
  }));

  const addText = () => addBlock({
    id: `text-${Date.now()}`,
    type: 'text',
    text: 'Enter your question or instructions here',
  });

  const addHeading = () => addBlock({
    id: `heading-${Date.now()}`, type: 'heading', text: 'Section heading',
  });

  const addAnswer = (response) => addBlock(
    createToken(response, questions[response.qKey] || response.question),
  );

  const addQuestion = (question) => addBlock(createQuestionToken(question));

  const dropAnswer = (event) => {
    event.preventDefault();
    const response = draggedToken;
    setDraggedToken(null);
    if (!response) return;
    addAnswer(response);
  };

  const updateBlock = (id, changes) => {
    setTemplate((current) => ({
      ...current,
      blocks: current.blocks.map((block) => block.id === id ? { ...block, ...changes } : block),
    }));
  };

  const moveBlock = (index, direction) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= template.blocks.length) return;
    setTemplate((current) => {
      const blocks = [...current.blocks];
      [blocks[index], blocks[nextIndex]] = [blocks[nextIndex], blocks[index]];
      return { ...current, blocks };
    });
  };

  const removeBlock = (id) => setTemplate((current) => ({
    ...current,
    blocks: current.blocks.filter((block) => block.id !== id),
  }));

  const canvasPages = useMemo(() => {
    const pages = [[]];
    let answerCount = 0;

    template.blocks.forEach((block, index) => {
      if (block.type === 'answer') {
        const pageIndex = Math.floor(answerCount / 5);
        while (pages.length <= pageIndex) pages.push([]);
        pages[pageIndex].push({ block, index });
        answerCount += 1;
        return;
      }

      const currentPage = Math.max(0, Math.ceil(answerCount / 5) - 1);
      while (pages.length <= currentPage) pages.push([]);
      pages[currentPage].push({ block, index });
    });

    return pages;
  }, [template.blocks]);

  useEffect(() => {
    setCanvasPage((current) => Math.min(current, Math.max(0, canvasPages.length - 1)));
  }, [canvasPages.length]);

  const visibleCanvasBlocks = canvasPages[canvasPage] ?? [];

  const setAsStandard = async () => {
    setStandardStatus('saving');
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('You must be signed in to publish a standard template');
      const idToken = await user.getIdToken();
      const response = await fetch(buildApiUrl(`/api/form-templates/${selectedFormat}`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(template),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to publish standard template');
      }
      setStandardStatus('saved');
    } catch (error) {
      console.error(error.message);
      setStandardStatus('error');
    }
  };

  return (
    <>
    <div className="page-container form-designer">
      <div className="page-content">
        <div className="form-designer__header">
          <div>
            <h1>Form Designer</h1>
            <p>Create a document, then add questions and answers from the palette.</p>
          </div>
          <button className="form-designer__print" onClick={() => navigate('/admin')}>
            <ArrowLeft size={16} /> Back to admin
          </button>
          <label className="form-designer__scenario">
            PDF format
            <select value={selectedFormat} onChange={changeFormat}>
              {Object.entries(TEMPLATE_FORMATS).map(([value, format]) => (
                <option key={value} value={value}>{format.label}</option>
              ))}
            </select>
          </label>
          <button className="form-designer__print" onClick={() => setIsPrinting(true)}>
            <Printer size={16} /> Preview / Print
          </button>
          <button className="form-designer__print" onClick={setAsStandard} disabled={standardStatus === 'saving'}>
            {standardStatus === 'saving' ? 'Publishing...' : 'Set as standard'}
          </button>
          {standardStatus === 'saved' && <span className="form-designer__status">Standard saved</span>}
          {standardStatus === 'error' && <span className="form-designer__status form-designer__status--error">Unable to publish standard</span>}
        </div>

        <div className="form-designer__workspace">
          <aside className="form-designer__palette">
            <h2>Document text</h2>
            <button onClick={addHeading}><Plus size={15} /> Add section heading</button>
            <button onClick={addText}><Plus size={15} /> Add question text</button>
            <label className="form-designer__question-search">
              Search questions
              <input
                type="search"
                value={questionSearch}
                onChange={(event) => setQuestionSearch(event.target.value)}
                placeholder="Search labels or question text"
              />
            </label>
            <h2>Pages</h2>
            <div className="form-designer__page-tabs" role="tablist" aria-label="Question pages">
              {palettePages.map((page) => (
                <button
                  className={selectedPalettePage === page ? 'form-designer__page-tab--active' : ''}
                  key={page}
                  onClick={() => setSelectedPalettePage(page)}
                  role="tab"
                  aria-selected={selectedPalettePage === page}
                >
                  {page}
                </button>
              ))}
            </div>
            {selectedQuestionGroup && (
              <>
                <h2>{selectedQuestionGroup[0]}</h2>
                <p className="form-designer__hint">Drag a question onto the document.</p>
                {selectedQuestionGroup[1].map((question) => (
                  <button
                    className="form-designer__answer-token"
                    draggable
                    key={question.qKey}
                    onDragStart={() => setDraggedToken(question)}
                    onClick={() => addQuestion(question)}
                  >
                    <GripVertical size={15} />
                    {shouldShowQuestionLabel(question) && (
                      <span className="form-designer__question-label">{questionLabel(question)}</span>
                    )}
                    <span className="form-designer__question-text">{questionDisplayText(question)}</span>
                  </button>
                ))}
              </>
            )}
            {availableQuestions.length === 0 && selectedPalettePage !== 'Personal info' && (
              <p className="form-designer__empty">All questions are placed.</p>
            )}
            {availableQuestions.length > 0 && filteredQuestions.length === 0 && (
              <p className="form-designer__empty">No questions match your search.</p>
            )}
            {selectedPalettePage === 'Personal info' && (
              <>
                <h2>Personal info</h2>
                <p className="form-designer__hint">Add parent and children information to the document as often as needed.</p>
                {availableAnswers.length === 0 && <p className="form-designer__empty">No personal information is available.</p>}
              </>
            )}
            {selectedPalettePage === 'Personal info' && availableAnswers.map((response) => (
              <button
                className="form-designer__answer-token"
                draggable
                key={response.qKey}
                onDragStart={() => setDraggedToken(response)}
                onClick={() => addAnswer(response)}
              >
                <GripVertical size={15} />
                {shouldShowQuestionLabel(questions[response.qKey] || response) && (
                  <span className="form-designer__question-label">
                    {questionLabel(questions[response.qKey] || response)}
                  </span>
                )}
                <span className="form-designer__question-text">
                  {questionDisplayText(questions[response.qKey] || response)}
                </span>
              </button>
            ))}
          </aside>

          <main
            className="form-designer__canvas form-designer__canvas--blank"
            onDragOver={(event) => event.preventDefault()}
            onDrop={dropAnswer}
          >
            <input
              className="form-designer__title"
              value={template.title}
              onChange={(event) => setTemplate((current) => ({ ...current, title: event.target.value }))}
              aria-label="Document title"
            />
            <div className="form-designer__canvas-pagination" aria-label="Document pages">
              <button
                type="button"
                onClick={() => setCanvasPage((current) => Math.max(0, current - 1))}
                disabled={canvasPage === 0}
              >
                Previous
              </button>
              <span>Page {canvasPage + 1} of {canvasPages.length}</span>
              <button
                type="button"
                onClick={() => setCanvasPage((current) => Math.min(canvasPages.length - 1, current + 1))}
                disabled={canvasPage === canvasPages.length - 1}
              >
                Next
              </button>
            </div>
            <div className="form-designer__print-title">{template.title}</div>
            {visibleCanvasBlocks.map(({ block, index }) => (
              <div
                className={`form-designer__block form-designer__block--${block.type}${
                  block.type === 'answer' && !hasAnswer(currentAnswersByKey[block.qKey]?.answer)
                    ? ' form-designer__block--unanswered'
                    : ''
                }`}
                key={block.id}
              >
                <div className="form-designer__block-controls">
                  <button onClick={() => moveBlock(index, -1)} aria-label="Move block up"><ArrowUp size={14} /></button>
                  <button onClick={() => moveBlock(index, 1)} aria-label="Move block down"><ArrowDown size={14} /></button>
                  <button onClick={() => removeBlock(block.id)} aria-label="Remove block"><Trash2 size={14} /></button>
                </div>
                {block.type === 'answer' ? (
                  <>
                    <label>Question text</label>
                    <textarea value={block.questionText} onChange={(event) => updateBlock(block.id, { questionText: event.target.value })} />
                    <div className="form-designer__print-text">{block.questionText}</div>
                    <label>Answer</label>
                    <div className="form-designer__answer-value">
                      {renderScheduleAnswer(
                        block.qKey,
                        currentAnswersByKey[block.qKey]?.answer,
                        questions[block.qKey] || currentAnswersByKey[block.qKey]?.question,
                      ) || answerText(
                        currentAnswersByKey[block.qKey]?.answer,
                        questions[block.qKey] || currentAnswersByKey[block.qKey]?.question,
                      )}
                    </div>
                  </>
                ) : (
                  <textarea value={block.text} onChange={(event) => updateBlock(block.id, { text: event.target.value })} />
                )}
                {block.type !== 'answer' && <div className="form-designer__print-text">{block.text}</div>}
              </div>
            ))}
            <p className="form-designer__drop-hint">
              Drop questions or answers into the document
            </p>
          </main>
        </div>
      </div>
    </div>
    {isPrinting && (
      <FormTemplatePrintDocument
        template={template}
        answersByKey={currentAnswersByKey}
        questions={questions}
        answeringParent={
          state.plan?.userRole === 'parent2/petitioner2/defendant'
            ? 'parent2'
            : state.plan?.userRole === 'no_case'
              ? 'no_case'
              : state.plan?.userRole === 'parent1/petitioner1/plaintiff'
                ? 'parent1'
                : null
        }
        showUnanswered
      />
    )}
    </>
  );
}
