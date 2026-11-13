import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { buildApiUrl } from '../lib/apiClient';
import { CUSTOM_COMPARISON_QUESTIONS } from '../lib/comparisonQuestionDefinitions';
import { ScheduleAnswer } from './Comparison';
import { CheckCircle, Flag, AlertTriangle, ArrowLeft } from 'lucide-react';
import './ResolutionReview.css';

export default function ResolutionReview() {
  const { caseId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [resolutions, setResolutions] = useState([]); // P1's proposed answers
  const [diffMap, setDiffMap] = useState({});          // { qKey: { parent2Answer } }
  const [questionMap, setQuestionMap] = useState({});   // { qKey: question }
  const [parentNames, setParentNames] = useState({ parent1: 'Parent 1', parent2: 'Parent 2' });
  // { [qKey]: true (accepted) | false (flagged) }
  const [reviews, setReviews] = useState({});
  const [submitStatus, setSubmitStatus] = useState('idle'); // idle | saving | error

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { navigate('/signin'); return; }
      try {
        const idToken = await user.getIdToken();

        // Guard: verify this user is P2 and status is resolutions_pending
        const statusRes = await fetch(buildApiUrl(`/api/v1/cases/${caseId}/status`), {
          headers: { Authorization: `Bearer ${idToken}` },
        });
        if (!statusRes.ok) { setError('Failed to load case.'); setLoading(false); return; }
        const statusData = await statusRes.json();
        setParentNames({
          parent1: statusData.parent1Name || 'Parent 1',
          parent2: statusData.parent2Name || 'Parent 2',
        });
        if (statusData.isParent1 || statusData.status !== 'resolutions_pending') {
          navigate(`/waiting/${caseId}`); return;
        }

        const [resRes, compRes, questionsRes] = await Promise.all([
          fetch(buildApiUrl(`/api/v1/cases/${caseId}/resolutions`), {
            headers: { Authorization: `Bearer ${idToken}` },
          }),
          fetch(buildApiUrl(`/api/v1/cases/${caseId}/plan-comparison`), {
            headers: { Authorization: `Bearer ${idToken}` },
          }),
          fetch(buildApiUrl('/api/logic-engine/questions')),
        ]);

        if (!resRes.ok) { setError('No resolutions found.'); setLoading(false); return; }
        const resData = await resRes.json();
        setResolutions(resData.resolutions || []);

        if (compRes.ok) {
          const compData = await compRes.json();
          const map = { ...CUSTOM_COMPARISON_QUESTIONS };
          (compData.diff || []).filter((d) => !d.agreement).forEach((d) => {
            map[d.questionKey] = { parent2Answer: d.parent2Answer };
          });
          setDiffMap(map);
        }

        if (questionsRes.ok) {
          const questionsData = await questionsRes.json();
          const questions = Array.isArray(questionsData) ? questionsData : questionsData.questions || [];
          const map = { ...CUSTOM_COMPARISON_QUESTIONS };
          questions.forEach((q) => { if (q.qKey) map[q.qKey] = q; });
          setQuestionMap(map);
        }
      } catch (e) {
        setError('Failed to load resolution data.');
      }
      setLoading(false);
    });
    return unsub;
  }, [caseId, navigate]);

  const formatAnswer = (val, questionKey, answerOwner) => {
    if (val === null || val === undefined) return 'Not answered';
    if (Array.isArray(val)) return val.map((value) => formatAnswer(value, questionKey, answerOwner)).join(', ');
    if (['meOnly', 'parent1'].includes(val)) return answerOwner === 'parent1' ? 'Just me' : 'Just my co-parent';
    if (['coParentOnly', 'parent2'].includes(val)) return answerOwner === 'parent1' ? 'Just my co-parent' : 'Just me';
    const option = questionMap[questionKey]?.options?.find((item) => item.value === val);
    if (option?.label) return option.label;
    return String(val);
  };

  const renderAnswer = (value, questionKey, answerOwner, otherParentValue) => {
    return formatAnswer(value, questionKey, answerOwner);
  };

  const isScheduleQuestion = (questionKey) => questionKey.startsWith('parentingTimeAndCommunication.')
    && ['parentingSchedule', 'holidaySchedule', 'schoolSchedule']
      .some((scheduleKey) => questionKey.endsWith(scheduleKey));

  const allReviewed = resolutions.length > 0 && resolutions.every((r) => reviews[r.qKey] !== undefined);

  const handleSubmit = async () => {
    setSubmitStatus('saving');
    try {
      const idToken = await auth.currentUser.getIdToken();
      const reviewsArray = resolutions.map((r) => ({ qKey: r.qKey, accepted: reviews[r.qKey] }));

      const res = await fetch(buildApiUrl(`/api/v1/cases/${caseId}/resolutions/review`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ reviews: reviewsArray }),
      });
      if (!res.ok) throw new Error('Failed to submit');
      navigate(`/comparison/${caseId}`);
    } catch (e) {
      console.error(e);
      setSubmitStatus('error');
    }
  };

  if (loading) {
    return (
      <div className="res-review res-review--centered">
        <div className="res-review__spinner" />
        <p>Loading resolutions…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="res-review res-review--centered">
        <AlertTriangle size={40} color="#f97316" aria-hidden="true" />
        <p className="res-review__error">{error}</p>
        <Link className="res-review__back-btn" to="/dashboard">Back to Dashboard</Link>
      </div>
    );
  }

  const acceptedCount = Object.values(reviews).filter(Boolean).length;
  const flaggedCount = Object.values(reviews).filter((v) => v === false).length;

  return (
    <div className="res-review">
      <div className="res-review__header">
        <Link className="res-review__nav-back" to="/dashboard">
          <ArrowLeft size={18} aria-hidden="true" /> Dashboard
        </Link>
        <div>
          <h1 className="res-review__title">Review Proposed Resolutions</h1>
          <p className="res-review__subtitle">
            Your co-parent has proposed answers for each point of disagreement. Accept each one or flag it for further discussion.
          </p>
        </div>
      </div>

      <div className="res-review__content">
        <div className="res-review__progress">
          <span className="res-review__progress-item res-review__progress-item--accepted">
            <CheckCircle size={14} aria-hidden="true" /> {acceptedCount} accepted
          </span>
          <span className="res-review__progress-item res-review__progress-item--flagged">
            <Flag size={14} aria-hidden="true" /> {flaggedCount} flagged
          </span>
          <span className="res-review__progress-item">
            {resolutions.length - acceptedCount - flaggedCount} remaining
          </span>
        </div>

        {resolutions.map((r) => {
          const accepted = reviews[r.qKey];
          return (
            <div
              key={r.qKey}
              className={`res-review__card ${accepted === true ? 'res-review__card--accepted' : accepted === false ? 'res-review__card--flagged' : ''}`}
            >
              <div className="res-review__question">{questionMap[r.qKey]?.qText || r.qKey}</div>

              {isScheduleQuestion(r.qKey) ? (
                <div className="res-review__answers res-review__answers--schedule">
                  <div className="res-review__answer-block res-review__answer-block--proposed">
                    <span className="res-review__answer-label">Parent 1 and Parent 2 schedule answers</span>
                    <ScheduleAnswer
                      questionKey={r.qKey}
                      value={r.proposedAnswer}
                      answerOwner="parent1"
                      parent1Value={r.proposedAnswer}
                      parent2Value={diffMap[r.qKey]?.parent2Answer}
                    />
                  </div>
                </div>
              ) : (
                <div className="res-review__answers">
                  <div className="res-review__answer-block res-review__answer-block--proposed">
                    <span className="res-review__answer-label">Co-parent's proposed answer</span>
                    <div className="res-review__answer-value">{renderAnswer(r.proposedAnswer, r.qKey, 'parent1')}</div>
                  </div>
                  <div className="res-review__answer-block">
                    <span className="res-review__answer-label">Your original answer</span>
                    <div className="res-review__answer-value">{renderAnswer(diffMap[r.qKey]?.parent2Answer, r.qKey, 'parent2')}</div>
                  </div>
                </div>
              )}

              <div className="res-review__actions">
                <button
                  className={`res-review__btn res-review__btn--accept ${accepted === true ? 'res-review__btn--active' : ''}`}
                  aria-pressed={accepted === true}
                  onClick={() => setReviews((prev) => ({ ...prev, [r.qKey]: true }))}
                >
                  <CheckCircle size={15} aria-hidden="true" /> Accept
                </button>
                <button
                  className={`res-review__btn res-review__btn--flag ${accepted === false ? 'res-review__btn--active-flag' : ''}`}
                  aria-pressed={accepted === false}
                  onClick={() => setReviews((prev) => ({ ...prev, [r.qKey]: false }))}
                >
                  <Flag size={15} aria-hidden="true" /> Flag for Discussion
                </button>
              </div>
            </div>
          );
        })}

        <div className="res-review__submit-row">
          <button
            className="res-review__submit-btn"
            onClick={handleSubmit}
            disabled={!allReviewed || submitStatus === 'saving'}
          >
            {submitStatus === 'saving' ? 'Sending…' : 'Send Feedback to Co-Parent →'}
          </button>
          {!allReviewed && (
            <p className="res-review__submit-hint">Review all items above to continue.</p>
          )}
          {submitStatus === 'error' && (
            <p className="res-review__submit-error" role="alert">Failed to send. Please try again.</p>
          )}
          <p className="sr-only" aria-live="polite">
            {submitStatus === 'saving' ? 'Sending feedback to your co-parent.' : ''}
          </p>
        </div>
      </div>
    </div>
  );
}
