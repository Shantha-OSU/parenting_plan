import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { CheckCircle, Download, UserPlus, Pencil, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/common/card';
import Disclaimer from '../components/forms/Disclaimer';
import InviteModal from '../components/common/InviteModal';
import { useForm } from '../hooks/useForm';
import { auth } from '../lib/firebase';
import { buildApiUrl } from '../lib/apiClient';
import { answerText, fetchStandardTemplate, FormTemplatePrintDocument, collectAnswers, standardTemplate } from './FormDesigner';
import shareCareLogo from '../assets/logos/ShareCare_Symmetrical Diamond Logo (1120 x 310 px).png';
import './Page.css';
import './Review.css';
import './FormDesigner.css';


// Section titles and routes
// Maps backend section enum values to UI label and frontend route for editing
// TODO: Update keys to match exact enum values - currently only have 1 created
const SECTION_META = {
  'getting-started': { label: 'Getting Started', route: '/getting-started' },
  'parental-rights': { label: 'Parental Rights', route: '/parental-rights' },
  'health-insurance-coverage': { label: 'Health Insurance Questions', route: '/parental-rights' },
  'parenting-time-communication': { label: 'Parenting Time & Communication', route: '/parenting-time-communication' },
  'information-sharing': { label: 'Information Sharing', route: '/informationsharing' },
  'tax-exemptions': { label: 'Tax Exemptions', route: '/tax-exemptions' },
};

// Formats stored answer values using the question's human-readable option labels.
function annotateParentReferences(text, isParent2) {
  if (typeof text !== 'string') return text;
  const currentParent = isParent2 ? '2' : '1';
  return text.replace(
    new RegExp(`\\bParent ${currentParent}\\b(?! \\(you\\))`, 'g'),
    `Parent ${currentParent} (you)`,
  );
}

function formatAnswer(answer, question, isParent2, userRole) {
  if (answer === null || answer === undefined || answer === '') {
    return <span className="review__empty">Not answered</span>;
  }

  const formatValue = (value) => {
    const option = question?.options?.find((item) => item.value === value);
    if (value && typeof value === 'object') return JSON.stringify(value);
    return option?.label || String(value);
  };

  if (question?.childAnswers) {
    const answeringParent = isParent2 ? 'parent2' : 'parent1';
    return annotateParentReferences(answerText(answer, question, answeringParent, true), isParent2);
  }
  if (Array.isArray(answer)) return annotateParentReferences(answerText(answer, question), isParent2);
  return annotateParentReferences(formatValue(answer), isParent2);
}

// Groups the state.plan.children array by question section
// Plan model representation of the array: plan.children = [{ questionID, answer, isFlagged, isDeferred }, ...]
// Question model includes "section" and "qKey" fields
// Groups saved plan answers by the section of their question definition.
function groupResponsesBySection(answers = [], questionsByKey = {}) {
  const grouped = {};

  answers.forEach((response) => {
    const question = questionsByKey[response.qKey];
    const sectionKey = question?.section;

    if (!sectionKey) return;

    if (!grouped[sectionKey]) {
      grouped[sectionKey] = [];
    }

    grouped[sectionKey].push({
      qKey: response.qKey,
      label: question.qTitle || question.qText || response.qKey,
      answer: response.answer,
      question,
      isFlagged: response.isFlagged,
      isDeferred: response.isDeferred,
    });
  });
  return grouped;
}

/* Parenting time & Information Sharing question text */
const CUSTOM_SECTION_FIELDS = {
  parentingTimeAndCommunication: {
    section: 'parenting-time-communication',
    fields: {
      agreeToTransportationPolicy: 'Agree to the standard transportation policy',
      transportationArrangementDescription: 'Preferred transportation arrangement',
      agreeToActivityPolicy: 'Agree to the standard activity policy',
      activityPolicyDescription: 'Preferred activity policy',
      communicationWithCoParentOnPhone: 'Phone communication with co-parent',
      communicationWithCoParentOnPhoneDescription: 'Phone communication circumstances',
      notifyCoParentOfChildRelatedEvents: 'Notify co-parent about illness or injury',
      notifyCoParentOfChildRelatedEventsDescription: 'Illness or injury notification circumstances',
    },
  },
  informationSharing: {
    section: 'information-sharing',
    fields: {
      medicalRecords: 'Medical information access',
      schoolContact: 'School contact rights',
      schoolActivities: 'School activity participation',
    },
  },
};

const INFORMATION_SHARING_OPTIONS = [
  { value: 'parent1', label: 'Just me' },
  { value: 'parent2', label: 'Just my co-parent' },
  { value: 'both', label: 'Both me and my co-parent' },
  { value: 'needInfo', label: 'I need more information' },
  { value: 'defer', label: "Default to my co-parent's choice" },
];

/* Parenting time & Information Sharing question options, translates stored values to human-readable labels for display in the review page */
const CUSTOM_FIELD_OPTIONS = {
  agreeToTransportationPolicy: [
    { value: true, label: 'I agree to the standard transportation policy' },
    { value: false, label: 'I do not agree with the standard transportation policy' },
  ],
  agreeToActivityPolicy: [
    { value: true, label: 'I agree to the standard activity policy' },
    { value: false, label: 'I do not agree with the standard activity policy' },
  ],
  communicationWithCoParentOnPhone: [
    { value: 'yes', label: 'Yes' },
    { value: 'no', label: 'No' },
    { value: 'sometimes', label: 'Sometimes (please describe)' },
    { value: 'needMoreInfo', label: 'I need more information' },
    { value: 'defaultToCoParentChoice', label: "Default to my co-parent's choice" },
  ],
  notifyCoParentOfChildRelatedEvents: [
    { value: 'yes', label: 'Yes' },
    { value: 'no', label: 'No' },
    { value: 'sometimes', label: 'Sometimes (please describe)' },
    { value: 'needMoreInfo', label: 'I need more information' },
    { value: 'defaultToCoParentChoice', label: "Default to my co-parent's choice" },
  ],
  medicalRecords: INFORMATION_SHARING_OPTIONS,
  schoolContact: INFORMATION_SHARING_OPTIONS,
  schoolActivities: INFORMATION_SHARING_OPTIONS,
};

const STATE_FIELD_OPTIONS = {
  userRole: [
    { value: 'parent1/petitioner1/plaintiff', label: 'Yes, it was me' },
    { value: 'parent2/petitioner2/defendant', label: 'No, my co-parent filed' },
    { value: 'no_case', label: 'No case has been filed yet by either co-parent' },
    { value: 'flagged', label: "I'm not sure" },
  ],
  residentialParent: [
    { value: 'yes', label: 'Yes, I am the residential parent' },
    { value: 'no', label: 'No, I am not the residential parent' },
  ],
  parentRole: [
    { value: 'residential', label: 'I am the residential parent' },
    { value: 'nonresidential', label: 'I am the non-residential parent' },
  ],
  collaborationMode: [
    { value: 'individual', label: 'I wish to complete the form on my own'},
    { value: 'collaborative', label: 'I wish to collaborate with my co-parent'},
  ],
};

/* Adds parenting time and information sharing responses to the grouped responses object for display in the review page. */
function addCustomSectionResponses(grouped, plan) {
  Object.entries(CUSTOM_SECTION_FIELDS).forEach(([planField, sectionConfig]) => {
    const sectionResponses = Object.entries(plan?.[planField] ?? {})
      .filter(([field, value]) => field !== 'errors' && field !== 'parentingSchedule' && field !== 'holidaySchedule' && field !== 'schoolSchedule' && value !== '' && value !== null && value !== undefined)
      .map(([field, answer]) => ({
        qKey: `${planField}.${field}`,
        label: sectionConfig.fields[field] || field,
        answer,
        question: { options: CUSTOM_FIELD_OPTIONS[field] ?? [] },
      }));

    if (sectionResponses.length > 0) {
      grouped[sectionConfig.section] = [
        ...(grouped[sectionConfig.section] ?? []),
        ...sectionResponses,
      ];
    }
  });
}

/* Displays children's names */
function addStateSectionResponses(grouped, plan) {
  const savedTaxExemptions = plan.taxExemptions ?? {};
  const childNames = (plan.children ?? []).map((child, index) => {
    const name = [child.fName ?? child.firstName, child.lName ?? child.lastName]
      .filter(Boolean)
      .join(' ')
      .trim();
    return name || child.name || `Child ${index + 1}`;
  });

  /* Adds gettings started and tax exemption responses to the grouped responses object for display in the review page. */
  const gettingStarted = [
    ['firstName', 'Your first name', plan.parentFName],
    ['lastName', 'Your last name', plan.parentLName],
    ['age', 'Your age', plan.parentAge],
    ['phone', 'Your phone number', plan.phoneNumber],
    ['streetAddress', 'Street address', plan.streetAddress],
    ['addressLine2', 'Address line 2', plan.addressLine2],
    ['city', 'City', plan.city],
    ['state', 'State', plan.state],
    ['zipCode', 'ZIP code', plan.zipCode],
    ['userRole', 'Case filing status', plan.userRole],
    ['residentialParent', 'Residential parent', plan.residentialParent],
    ['children', 'Children', childNames],
  ];
  const taxExemptions = [
    ['parentRole', 'Parental role', savedTaxExemptions?.parentRole],
    ['childAnswers', 'Tax exemption arrangements for each child', savedTaxExemptions?.childAnswers],
  ];

  [
    ['getting-started', gettingStarted],
    ['tax-exemptions', taxExemptions],
  ].forEach(([section, fields]) => {
    const responses = fields
      .filter(([, , answer]) => answer !== '' && answer !== null && answer !== undefined)
      .map(([key, label, answer]) => ({
        qKey: `${section}.${key}`,
        label,
        answer,
        question: key === 'childAnswers'
          ? { childAnswers: true }
          : { options: STATE_FIELD_OPTIONS[key] ?? [] },
      }));

    if (responses.length > 0) {
      const responseKeys = new Set(responses.map((response) => response.qKey));
      grouped[section] = [
        ...(grouped[section] ?? []).filter((response) => !responseKeys.has(response.qKey)),
        ...responses,
      ];
    }
  });
}


function SectionBlock({ sectionKey, responses, onEdit, onEditQuestion, isOpen, onToggle, isParent2, userRole }) {
  const [isEditingQuestions, setIsEditingQuestions] = useState(false);
  const supportsQuestionEditing = ['parental-rights', 'health-insurance-coverage'].includes(sectionKey);
  const meta = SECTION_META[sectionKey] || {
    label: sectionKey.replaceAll('_', ' '),
    route: '/',
  };
  const hasAnswers = responses && responses.length > 0;

  return (
    <Card className="review__section-card">
      <CardHeader className="review__section-card-header">
        <div className="review__section-header" onClick={onToggle} role="button" aria-expanded={isOpen} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onToggle()}>
          <div className="review__section-header-left">
            <CheckCircle
              size={18}
              className={hasAnswers ? 'review__check--complete' : 'review__check--incomplete'}
            />
            <span className="review__section-title">{meta.label}</span>
          </div>
          <div className="review__section-header-right">
            <button
              className="review__edit-btn"
              onClick={(e) => {
                e.stopPropagation();
                if (supportsQuestionEditing) {
                  setIsEditingQuestions((editing) => !editing);
                } else {
                  onEdit(meta.route);
                }
              }}
              aria-label={`Edit ${meta.label}`}
              aria-pressed={supportsQuestionEditing ? isEditingQuestions : undefined}
            >
              <Pencil size={14} />
              {supportsQuestionEditing && isEditingQuestions ? 'Done' : 'Edit'}
            </button>
            {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </div>
        </div>
      </CardHeader>

      {isOpen && (
        <CardContent className="review__section-card-content">
          {supportsQuestionEditing && isEditingQuestions && (
            <p className="review__question-edit-hint">
              Click a question below to edit it.
            </p>
          )}
          {hasAnswers ? (
            <ul className="review__answer-list">
              {responses.map((r, i) => (
                <li key={r.qKey || i} className="review__answer-item">
                  {supportsQuestionEditing && isEditingQuestions ? (
                    <button
                      className="review__answer-key review__answer-question-btn"
                      onClick={() => onEditQuestion(r.qKey)}
                      aria-label={`Edit ${r.label}`}
                    >
                      {r.label}
                    </button>
                  ) : (
                    <span className="review__answer-key">{r.label}</span>
                  )}
                  <span className="review__answer-value">
                    {formatAnswer(r.answer, r.question, isParent2, userRole)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="review__section-empty">No answers recorded for this section yet.</p>
          )}
        </CardContent>
      )}
    </Card>
  );
}


function PrintablePlan({ groupedResponses, sectionKeys, plan }) {
  const parentName = [plan.parentFName, plan.parentLName]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="review__print-document">
      <header className="review__print-header">
        <img src={shareCareLogo} alt="ShareCare" className="review__print-logo" />
        <div>
          <h1>Parenting Plan Questionnaire Responses</h1>
          <p>{parentName || 'Parent'}{plan.name ? ` · ${plan.name}` : ''}</p>
          <p>Generated {new Date().toLocaleDateString()}</p>
        </div>
      </header>

      <div className="review__print-disclaimer">
        This document contains the questionnaire responses entered in ShareCare. It is a draft
        and is not legal advice or a court-approved parenting plan.
      </div>

      {sectionKeys.map((sectionKey) => {
        const meta = SECTION_META[sectionKey] || {
          label: sectionKey.replaceAll('_', ' '),
        };
        const responses = groupedResponses[sectionKey] ?? [];

        return (
          <section className="review__print-section" key={sectionKey}>
            <h2>{meta.label}</h2>
            {responses.length > 0 ? (
              <dl>
                {responses.map((response, index) => (
                  <div className="review__print-answer" key={response.qKey || index}>
                    <dt>{response.question?.qText || response.label}</dt>
                    <dd>
                      <span className="review__print-answer-label">Answer</span>
                      {formatAnswer(response.answer, response.question, plan.isParent2 === true, plan.userRole)}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="review__print-empty">No answers recorded for this section.</p>
            )}
          </section>
        );
      })}
    </div>
  );
}


export default function Review() {
  const navigate = useNavigate();
  const { state, dispatch } = useForm();
  const [storedPlan, setStoredPlan] = useState(null);
  const planId = state.plan?._id;

  useEffect(() => {
    if (!planId) {
      setStoredPlan(null);
      return undefined;
    }

    let isActive = true;
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) return;
      user.getIdToken()
        .then((idToken) => fetch(buildApiUrl(`api/plan/${planId}`), {
          headers: { Authorization: 'Bearer ' + idToken },
        }))
        .then((response) => {
          if (!response.ok) throw new Error('Failed to load the saved plan');
          return response.json();
        })
        .then((plan) => {
          if (isActive) setStoredPlan(plan);
        })
        .catch((error) => {
          if (isActive) {
            setStoredPlan(null);
            console.error(error.message);
          }
        });
    });

    return () => {
      isActive = false;
      unsubscribe();
    };
  }, [planId]);

  const reviewPlan = storedPlan || state.plan || {};

  // collaborationMode drives invite button behaviour — mirrors Dashboard logic:
  //   'locked-individual' — safety concern; invite button hidden entirely
  //   'individual'        — user chose solo; show switch prompt before opening invite
  //   'collaborative'     — user chose collaborative; invite button opens modal directly
  //   ''                  — not yet set; treat same as individual (no invite)
  const collaborationMode = reviewPlan.collaborationMode ?? '';
  const isSharedPlan = reviewPlan.isShared === true;

  const [questionsByKey, setQuestionsByKey] = useState({});
  const groupedResponses = groupResponsesBySection(reviewPlan.answers || [], questionsByKey);
  addCustomSectionResponses(groupedResponses, reviewPlan);
  addStateSectionResponses(groupedResponses, reviewPlan);
  const designerState = {
    plan: reviewPlan,
    parents: {
      firstName: reviewPlan.parentFName,
      lastName: reviewPlan.parentLName,
      age: reviewPlan.parentAge,
      phone: reviewPlan.phoneNumber,
      streetAddress: reviewPlan.streetAddress,
      addressLine2: reviewPlan.addressLine2,
      city: reviewPlan.city,
      state: reviewPlan.state,
      zipCode: reviewPlan.zipCode,
    },
    timeAndCommunication: {
      ...(reviewPlan.timeAndCommunication || {}),
      ...(reviewPlan.parentingTime || {}),
      ...(reviewPlan.parentingTimeAndCommunication || {}),
    },
    taxExemptions: reviewPlan.taxExemptions,
    flags: state.flags,
  };
  const reviewAnswersByKey = Object.fromEntries(
    collectAnswers(designerState, questionsByKey).map((response) => [response.qKey, response]),
  );
  const knownSectionKeys = Object.keys(SECTION_META);

  const [openSections, setOpenSections] = useState(() =>
    Object.fromEntries(knownSectionKeys.map((k) => [k, true]))
  );

  const [inviteOpen, setInviteOpen] = useState(false);
  const [showSwitchPrompt, setShowSwitchPrompt] = useState(false);
  const [caseStatus, setCaseStatus] = useState(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [standardReviewTemplate, setStandardReviewTemplate] = useState(null);
  

  const caseId = reviewPlan.caseId;

  useEffect(() => {
    let active = true;
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user || !active) return;
      try {
        const idToken = await user.getIdToken();
        const response = await fetch(buildApiUrl('/api/auth/me'), {
          headers: { Authorization: `Bearer ${idToken}` },
        });
        if (!response.ok) throw new Error('Failed to load user role');
        const data = await response.json();
      } catch (error) {
        if (active) {
          console.error(error.message);
        }
      }
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    fetchStandardTemplate('review')
      .then((template) => {
        if (template?.blocks) setStandardReviewTemplate(template);
      })
      .catch((error) => console.error(error.message));
  }, []);

  useEffect(() => {
    if (!caseId) return undefined;

    let isActive = true;
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) return;

      user.getIdToken()
        .then((idToken) => fetch(buildApiUrl(`api/v1/cases/${caseId}/status`), {
          headers: { Authorization: 'Bearer ' + idToken },
        }))
        .then((res) => res.ok ? res.json() : null)
        .then((data) => {
          if (isActive && data?.status) setCaseStatus(data.status);
        })
        .catch(() => {});
    });

    return () => {
      isActive = false;
      unsubscribe();
    };
  }, [caseId]);

  useEffect(() => {
    fetch(buildApiUrl('/api/logic-engine/questions'))
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load question definitions');
        return res.json();
      })
      .then((questions) => {
        const questionMap = {};
        questions.forEach((question) => {
          if (question.qKey) questionMap[question.qKey] = question;
        });
        setQuestionsByKey(questionMap);
      })
      .catch((error) => console.error(error.message));
  }, []);

  const toggleSection = (key) =>
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));

  const handleEdit = (route) => navigate(route);

  const handleEditQuestion = async (qKey) => {
    try {
      const question = questionsByKey[qKey];
      if (question) {
        dispatch({ type: 'UPDATE_SECTION', section: 'question', payload: question });
        navigate('/parental-rights');
        return;
      }

      const response = await fetch(buildApiUrl(`/api/logic-engine/question/${encodeURIComponent(qKey)}`));
      if (!response.ok) throw new Error(`Failed to load question ${qKey}`);
      const loadedQuestion = await response.json();
      dispatch({ type: 'UPDATE_SECTION', section: 'question', payload: loadedQuestion });
      navigate('/parental-rights');
    } catch (error) {
      console.error(error.message);
    }
  };

  const completedCount = knownSectionKeys.filter(
    (k) => groupedResponses[k]?.length > 0
  ).length;
  const totalCount = knownSectionKeys.length;
  const allComplete = completedCount === totalCount;

  // Routes invite click based on collaborationMode — same logic as Dashboard.
  const handleInviteClick = () => {
    if (collaborationMode === 'collaborative') {
      setInviteOpen(true);
    } else if (collaborationMode === 'individual' || collaborationMode === '') {
      setShowSwitchPrompt(true);
    }
    // 'locked-individual' — button is not rendered, so this is unreachable
  };

  // User confirmed switch from individual to collaborative, then open invite modal.
  // TODO: When the invite feature branch is merged, this switch will need to handle
  // the case where the user has already made progress in individual mode. Consider
  // whether answers need to be migrated, reset, or left as-is, and whether any
  // previously sent invites (if any) need to be revoked or re-sent.
  const handleConfirmSwitch = () => {
    dispatch({ type: 'UPDATE_SECTION', section: 'collaborationMode', payload: 'collaborative' });
    dispatch({ type: 'UPDATE_SECTION', section: 'plan', payload: {collaborationMode: 'collaborative'} });
    setShowSwitchPrompt(false);
    setInviteOpen(true);
  };

  const showInviteUI = collaborationMode !== 'locked-individual' && !isSharedPlan;
  useEffect(() => {
    if (!isPrinting) return undefined;

    const printTimer = setTimeout(() => {
      window.print();
      setIsPrinting(false);
    }, 0);

    return () => clearTimeout(printTimer);
  }, [isPrinting]);

  const handleDownload = () => setIsPrinting(true);

  return (
    <>
      <div className="page-container">
        <div className="page-content">

        {/* Switch-to-collaborative confirmation prompt */}
        {showSwitchPrompt && (
          <div className="delete-modal__overlay" onClick={() => setShowSwitchPrompt(false)}>
            <div className="delete-modal" onClick={e => e.stopPropagation()}>
              <h3 className="delete-modal__title">Switch to collaborative mode?</h3>
              <p className="delete-modal__body">
                You're currently completing this plan individually. Switching to collaborative
                mode will allow your co-parent to fill out their section separately. Would you
                like to switch?
              </p>
              <div className="delete-modal__actions">
                <button className="delete-modal__cancel" onClick={() => setShowSwitchPrompt(false)}>
                  Stay in individual mode
                </button>
                <button className="delete-modal__confirm" onClick={handleConfirmSwitch}>
                  Switch &amp; invite co-parent
                </button>
              </div>
            </div>
          </div>
        )}

        <Card>
          <CardHeader>
            <div className="review__header-row">
              <div>
                <CardTitle>Review & Submit Your Plan</CardTitle>
                <CardDescription>
                  Check your answers before downloading or inviting your co-parent.
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <hr className="section-divider" />

            <Disclaimer variant="info">
              This tool helps you draft a parenting plan but does <strong>not</strong> constitute
              legal advice. This document is not a substitute for consultation with a licensed
              attorney. Review all answers carefully before submitting to the court.
            </Disclaimer>

            <div className="review__sections">
              {knownSectionKeys.map((key) => (
                <SectionBlock
                  key={key}
                  sectionKey={key}
                  responses={groupedResponses[key] ?? []}
                  isParent2={reviewPlan.isParent2 === true}
                  userRole={reviewPlan.userRole}
                  onEdit={handleEdit}
                  onEditQuestion={handleEditQuestion}
                  isOpen={openSections[key]}
                  onToggle={() => toggleSection(key)}
                />
              ))}
            </div>

            {!allComplete && (
              <Disclaimer variant="warning">
                Some sections are incomplete. You can still download or invite your co-parent,
                but the plan may not be accepted by the court.
              </Disclaimer>
            )}

            <div className="review__actions">
              <div className="review__action-buttons">
                {/* Invite button — hidden for locked-individual (safety concern) users */}
                {showInviteUI && (
                  <button
                    className="review__btn-invite"
                    onClick={handleInviteClick}
                  >
                    <UserPlus size={16} />
                    {collaborationMode === 'individual' || collaborationMode === ''
                      ? 'Switch & Invite Co-Parent'
                      : 'Invite Co-Parent'}
                  </button>
                )}

                <button className="review__btn-download" onClick={handleDownload}>
                  <Download size={16} />
                  Download PDF
                </button>
              </div>

              {/* Show comparison button only in collaborative mode and after an invite has been sent. */}
              {collaborationMode === 'collaborative' && caseId && caseStatus && isSharedPlan && caseStatus !== 'draft' && (
                <button
                  className="review__btn-invite"
                  onClick={() => navigate(`/comparison/${caseId}`)}
                >
                  View Comparison →
                </button>
              )}
            </div>

          </CardContent>
        </Card>
        </div>

        {/* caseId lets the modal send a real invite linked to this shared case */}
        <InviteModal
          isOpen={inviteOpen}
          onClose={() => setInviteOpen(false)}
          caseId={caseId}
          onInviteSent={() => setCaseStatus('pending_invite')}
        />
      </div>
      {isPrinting && (
        <FormTemplatePrintDocument
          template={standardReviewTemplate || standardTemplate('review', reviewAnswersByKey, questionsByKey)}
          answersByKey={reviewAnswersByKey}
          questions={questionsByKey}
          answeringParent={
            reviewPlan.userRole === 'parent2/petitioner2/defendant'
              ? 'parent2'
              : reviewPlan.userRole === 'no_case'
                ? 'no_case'
              : reviewPlan.userRole === 'parent1/petitioner1/plaintiff'
                ? 'parent1'
                : null
          }
        />
      )}
    </>
  );
}