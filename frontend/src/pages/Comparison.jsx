import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { buildApiUrl } from '../lib/apiClient';
import { CheckCircle, AlertTriangle, Users, ArrowLeft, MessageCircle } from 'lucide-react';
import './Comparison.css';

const MEDIATION_RESOURCES = [
  'Ohio Mediation Association: ohiomediation.org',
  'Ohio State Bar Association Lawyer Referral: ohiobar.org',
  'Family Court Self-Help Center: contact your local courthouse',
];

export default function Comparison() {
  const { caseId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [diff, setDiff] = useState([]);
  const [caseStatus, setCaseStatus] = useState('');
  const [isParent1, setIsParent1] = useState(false);
  const [questionMap, setQuestionMap] = useState({});
  const [activeTab, setActiveTab] = useState('merged');

  // P1 resolution selections: { [qKey]: { choice: 'parent1'|'parent2'|'custom', customText: '' } }
  const [selections, setSelections] = useState({});
  const [submitStatus, setSubmitStatus] = useState('idle'); // idle | saving | saved | error

  // Final resolved answers for resolved/needs_discussion view
  const [resolvedAnswers, setResolvedAnswers] = useState({});
  // qKeys P2 flagged that P1 kept (still need discussion)
  const [needsDiscussionKeys, setNeedsDiscussionKeys] = useState(new Set());

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { navigate('/signin'); return; }
      try {
        const idToken = await user.getIdToken();

        const [statusRes, compRes, questionsRes] = await Promise.all([
          fetch(buildApiUrl(`/api/v1/cases/${caseId}/status`), {
            headers: { Authorization: `Bearer ${idToken}` },
          }),
          fetch(buildApiUrl(`/api/v1/cases/${caseId}/plan-comparison`), {
            headers: { Authorization: `Bearer ${idToken}` },
          }),
          fetch(buildApiUrl('/api/logic-engine/questions')),
        ]);

        if (!statusRes.ok) { setError('Failed to load case status.'); setLoading(false); return; }
        const statusData = await statusRes.json();
        const status = statusData.status;
        const parent1 = statusData.isParent1;
        setCaseStatus(status);
        setIsParent1(parent1);

        // Redirect based on status + role
        if (status === 'comparison_ready' && !parent1) {
          navigate(`/waiting/${caseId}`); return;
        }
        if (status === 'resolutions_pending') {
          navigate(parent1 ? `/waiting/${caseId}` : `/resolution-review/${caseId}`); return;
        }
        if (status === 'resolutions_reviewed') {
          navigate(parent1 ? `/resolution/${caseId}` : `/waiting/${caseId}`); return;
        }

        const compData = await compRes.json();
        if (!compRes.ok) { setError(compData.error || 'Failed to load comparison.'); setLoading(false); return; }

        setDiff(compData.diff || []);

        if (questionsRes.ok) {
          const questionsData = await questionsRes.json();
          const questions = Array.isArray(questionsData) ? questionsData : questionsData.questions || [];
          const map = {};
          questions.forEach((q) => { if (q.qKey) map[q.qKey] = q.qText || q.qKey; });
          setQuestionMap(map);
        }

        // For resolved/needs_discussion: fetch Resolution (and review for needs_discussion)
        if (['resolved', 'needs_discussion'].includes(status)) {
          const fetches = [
            fetch(buildApiUrl(`/api/v1/cases/${caseId}/resolutions`), {
              headers: { Authorization: `Bearer ${idToken}` },
            }),
          ];
          if (status === 'needs_discussion') {
            fetches.push(fetch(buildApiUrl(`/api/v1/cases/${caseId}/resolutions/review`), {
              headers: { Authorization: `Bearer ${idToken}` },
            }));
          }
          const [resRes, reviewRes] = await Promise.all(fetches);

          if (resRes.ok) {
            const resData = await resRes.json();
            const answerMap = {};
            (resData.resolutions || []).forEach((r) => { answerMap[r.qKey] = r.proposedAnswer; });
            setResolvedAnswers(answerMap);
          }

          if (status === 'needs_discussion' && reviewRes?.ok) {
            const reviewData = await reviewRes.json();
            // Items P2 flagged AND P1 kept (not in resolvedAnswers changes) are still disagreed.
            // The backend already computed this: status is needs_discussion only for kept items.
            // We show exactly the items P2 flagged that P1 chose "keep my answer" for —
            // those are flagged keys where P1's final answer equals their original proposed answer.
            const flaggedKeys = new Set(
              (reviewData.reviews || []).filter((r) => !r.accepted).map((r) => r.qKey)
            );
            setNeedsDiscussionKeys(flaggedKeys);
          }
        }
      } catch (e) {
        setError('Failed to load comparison data.');
      }
      setLoading(false);
    });
    return unsub;
  }, [caseId, navigate]);

  const agreed = diff.filter((d) => d.agreement);
  const disagreed = diff.filter((d) => !d.agreement);

  const formatAnswer = (val) => {
    if (val === null || val === undefined) return 'Not answered';
    if (Array.isArray(val)) return val.join(', ');
    return String(val);
  };

  const setSelection = (qKey, choice) => {
    setSelections((prev) => ({
      ...prev,
      [qKey]: { choice, customText: prev[qKey]?.customText ?? '' },
    }));
  };

  const setCustomText = (qKey, text) => {
    setSelections((prev) => ({
      ...prev,
      [qKey]: { choice: 'custom', customText: text },
    }));
  };

  const allResolved = disagreed.length > 0 && disagreed.every((item) => {
    const sel = selections[item.questionKey];
    if (!sel) return false;
    if (sel.choice === 'custom') return sel.customText.trim().length > 0;
    return true;
  });

  const handleSendResolutions = async () => {
    setSubmitStatus('saving');
    try {
      const idToken = await auth.currentUser.getIdToken();
      const resolutions = disagreed.map((item) => {
        const sel = selections[item.questionKey];
        const proposedAnswer = sel.choice === 'parent1'
          ? item.parent1Answer
          : sel.choice === 'parent2'
            ? item.parent2Answer
            : sel.customText.trim();
        return { qKey: item.questionKey, proposedAnswer, source: sel.choice };
      });

      const res = await fetch(buildApiUrl(`/api/v1/cases/${caseId}/resolutions`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ resolutions }),
      });
      if (!res.ok) throw new Error('Failed to submit');
      setSubmitStatus('saved');
      navigate(`/waiting/${caseId}`);
    } catch (e) {
      console.error(e);
      setSubmitStatus('error');
    }
  };

  if (loading) {
    return (
      <div className="comparison comparison--centered">
        <div className="comparison__spinner" />
        <p>Loading comparison...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="comparison comparison--centered">
        <AlertTriangle size={40} color="#f97316" />
        <p className="comparison__error">{error}</p>
        <button className="comparison__back-btn" onClick={() => navigate('/dashboard')}>Back to Dashboard</button>
      </div>
    );
  }

  if (caseStatus === 'waiting_for_coparent') {
    return (
      <div className="comparison comparison--centered">
        <Users size={48} color="#14abdd" />
        <h2>Waiting for Co-parent</h2>
        <p>Your co-parent hasn't joined yet. Once they accept the invite, you'll see the comparison here.</p>
        <button className="comparison__back-btn" onClick={() => navigate('/dashboard')}>Back to Dashboard</button>
      </div>
    );
  }

  // ── needs_discussion view ──────────────────────────────────────────────────
  if (caseStatus === 'needs_discussion') {
    // Show only items P2 flagged AND where P1's final answer still differs from P2's.
    // If P1 adopted P2's answer (or a custom answer that matches), exclude it.
    const stillDisagreed = disagreed.filter((item) =>
      needsDiscussionKeys.has(item.questionKey) &&
      JSON.stringify(resolvedAnswers[item.questionKey]) !== JSON.stringify(item.parent2Answer)
    );

    // All flagged items were resolved client-side — show merged plan view instead.
    if (stillDisagreed.length === 0) {
      const allItems = [
        ...agreed.map((item) => ({ qKey: item.questionKey, answer: item.parent1Answer })),
        ...disagreed.map((item) => ({ qKey: item.questionKey, answer: resolvedAnswers[item.questionKey] ?? item.parent1Answer })),
      ];
      return (
        <div className="comparison">
          <div className="comparison__header">
            <button className="comparison__nav-back" onClick={() => navigate('/dashboard')}>
              <ArrowLeft size={18} /> Dashboard
            </button>
            <div>
              <h1 className="comparison__title">Merged Parenting Plan</h1>
              <p className="comparison__subtitle">
                <CheckCircle size={16} color="#22c55e" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />
                All conflicts resolved
              </p>
            </div>
          </div>
          <div className="comparison__content">
            {allItems.map((item) => (
              <div key={item.qKey} className="comparison__card comparison__agreed">
                <div className="comparison__question">{questionMap[item.qKey] || item.qKey}</div>
                <div className="comparison__answer-agreed">
                  <CheckCircle size={16} color="#22c55e" />
                  {formatAnswer(item.answer)}
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className="comparison">
        <div className="comparison__header">
          <button className="comparison__nav-back" onClick={() => navigate('/dashboard')}>
            <ArrowLeft size={18} /> Dashboard
          </button>
          <div>
            <h1 className="comparison__title">Items Needing Discussion</h1>
            <p className="comparison__subtitle">
              <MessageCircle size={16} color="#f97316" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />
              {stillDisagreed.length} item{stillDisagreed.length !== 1 ? 's' : ''} still need agreement
            </p>
          </div>
        </div>
        <div className="comparison__content">
          <div className="comparison__discussion-banner">
            <AlertTriangle size={20} color="#f97316" />
            <p>You and your co-parent were unable to fully agree on the following items. Please discuss these together or consider seeking mediation support.</p>
          </div>
          {stillDisagreed.map((item) => (
            <div key={item.questionKey} className="comparison__card comparison__disagreed">
              <div className="comparison__question">{questionMap[item.questionKey] || item.questionKey}</div>
              <div className="comparison__answer-row">
                <div className="comparison__answer-col">
                  <span className="comparison__parent-label">Proposed answer</span>
                  <span className="comparison__answer-value">{formatAnswer(resolvedAnswers[item.questionKey] ?? item.parent1Answer)}</span>
                </div>
                <div className="comparison__answer-divider"/>
                <div className="comparison__answer-col">
                  <span className="comparison__parent-label">Co-parent's answer</span>
                  <span className="comparison__answer-value">{formatAnswer(item.parent2Answer)}</span>
                </div>
              </div>
            </div>
          ))}
          <div className="comparison__mediation-box">
            <h3>Mediation Resources</h3>
            <ul>
              {MEDIATION_RESOURCES.map((r) => <li key={r}>{r}</li>)}
            </ul>
          </div>
        </div>
      </div>
    );
  }

  // ── resolved view ─────────────────────────────────────────────────────────
  if (caseStatus === 'resolved') {
    const allItems = [
      ...agreed.map((item) => ({ qKey: item.questionKey, answer: item.parent1Answer })),
      ...disagreed.map((item) => ({ qKey: item.questionKey, answer: resolvedAnswers[item.questionKey] ?? item.parent1Answer })),
    ];
    return (
      <div className="comparison">
        <div className="comparison__header">
          <button className="comparison__nav-back" onClick={() => navigate('/dashboard')}>
            <ArrowLeft size={18} /> Dashboard
          </button>
          <div>
            <h1 className="comparison__title">Merged Parenting Plan</h1>
            <p className="comparison__subtitle">
              <CheckCircle size={16} color="#22c55e" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />
              All {allItems.length} items resolved
            </p>
          </div>
        </div>
        <div className="comparison__content">
          {allItems.map((item) => (
            <div key={item.qKey} className="comparison__card comparison__agreed">
              <div className="comparison__question">{questionMap[item.qKey] || item.qKey}</div>
              <div className="comparison__answer-agreed">
                <CheckCircle size={16} color="#22c55e" />
                {formatAnswer(item.answer)}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── comparison_ready view (P1 resolution mode) ────────────────────────────
  return (
    <div className="comparison">
      <div className="comparison__header">
        <button className="comparison__nav-back" onClick={() => navigate('/dashboard')}>
          <ArrowLeft size={18} /> Dashboard
        </button>
        <div>
          <h1 className="comparison__title">Parenting Plan Comparison</h1>
          <p className="comparison__subtitle">
            <CheckCircle size={16} color="#22c55e" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />
            {agreed.length} of {diff.length} questions in agreement
          </p>
        </div>
      </div>

      <div className="comparison__tabs">
        <button
          className={`comparison__tab ${activeTab === 'merged' ? 'comparison__tab--active' : ''}`}
          onClick={() => setActiveTab('merged')}
        >
          Agreed ({agreed.length})
        </button>
        <button
          className={`comparison__tab ${activeTab === 'differences' ? 'comparison__tab--active' : ''}`}
          onClick={() => setActiveTab('differences')}
        >
          Differences ({disagreed.length})
        </button>
      </div>

      <div className="comparison__content">
        {activeTab === 'merged' && (
          <div>
            <div className="comparison__section-header">
              <h2>Agreed Answers</h2>
              <p>These answers are identical for both parents and will be included in the final plan.</p>
            </div>
            {agreed.length === 0 ? (
              <div className="comparison__empty">No agreed answers yet — complete more of the questionnaire.</div>
            ) : (
              agreed.map((item) => (
                <div key={item.questionKey} className="comparison__card comparison__agreed">
                  <div className="comparison__question">{questionMap[item.questionKey] || item.questionKey}</div>
                  <div className="comparison__answer-agreed">
                    <CheckCircle size={16} color="#22c55e" />
                    {formatAnswer(item.parent1Answer)}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'differences' && (
          <div>
            <div className="comparison__section-header">
              <h2>Resolve Differences</h2>
              <p>
                {isParent1
                  ? 'For each difference, choose which answer to propose or enter a custom one. When done, send your proposed resolutions to your co-parent.'
                  : 'Your co-parent is reviewing these differences and will propose resolutions.'}
              </p>
            </div>

            {disagreed.length === 0 ? (
              <div className="comparison__empty">No differences — you agree on everything!</div>
            ) : (
              disagreed.map((item) => {
                const sel = selections[item.questionKey] ?? {};
                return (
                  <div key={item.questionKey} className="comparison__card comparison__disagreed">
                    <div className="comparison__question">{questionMap[item.questionKey] || item.questionKey}</div>
                    <div className="comparison__answer-row">
                      <div className="comparison__answer-col">
                        <span className="comparison__parent-label">Your answer</span>
                        <span className="comparison__answer-value">{formatAnswer(item.parent1Answer)}</span>
                      </div>
                      <div className="comparison__answer-divider"/>
                      <div className="comparison__answer-col">
                        <span className="comparison__parent-label">Co-parent's answer</span>
                        <span className="comparison__answer-value">{formatAnswer(item.parent2Answer)}</span>
                      </div>
                    </div>

                    {isParent1 && (
                      <div className="comparison__resolution-choices">
                        <label className={`comparison__choice ${sel.choice === 'parent1' ? 'comparison__choice--selected' : ''}`}>
                          <input type="radio" name={item.questionKey} value="parent1" checked={sel.choice === 'parent1'} onChange={() => setSelection(item.questionKey, 'parent1')} />
                          Keep my answer
                        </label>
                        <label className={`comparison__choice ${sel.choice === 'parent2' ? 'comparison__choice--selected' : ''}`}>
                          <input type="radio" name={item.questionKey} value="parent2" checked={sel.choice === 'parent2'} onChange={() => setSelection(item.questionKey, 'parent2')} />
                          Use co-parent's answer
                        </label>
                        <label className={`comparison__choice ${sel.choice === 'custom' ? 'comparison__choice--selected' : ''}`}>
                          <input type="radio" name={item.questionKey} value="custom" checked={sel.choice === 'custom'} onChange={() => setSelection(item.questionKey, 'custom')} />
                          Enter a custom answer
                        </label>
                        {sel.choice === 'custom' && (
                          <input
                            className="comparison__custom-input"
                            type="text"
                            placeholder="Type your proposed answer..."
                            value={sel.customText ?? ''}
                            onChange={(e) => setCustomText(item.questionKey, e.target.value)}
                          />
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}

            {isParent1 && disagreed.length > 0 && (
              <div className="comparison__submit-row">
                <button
                  className="comparison__download-btn"
                  onClick={handleSendResolutions}
                  disabled={!allResolved || submitStatus === 'saving'}
                >
                  {submitStatus === 'saving' ? 'Sending...' : 'Send Resolutions to Co-Parent →'}
                </button>
                {!allResolved && (
                  <p className="comparison__submit-hint">Resolve all differences above to continue.</p>
                )}
                {submitStatus === 'error' && (
                  <p className="comparison__submit-error">Failed to send. Please try again.</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
