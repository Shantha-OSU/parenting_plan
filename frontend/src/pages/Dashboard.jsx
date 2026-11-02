import { onAuthStateChanged, signOut } from 'firebase/auth';
import { Calendar, FileText, Lock, Pencil, Plus, Trash2, UserPlus, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Header from '../components/common/Header';
import InviteModal from '../components/common/InviteModal';
import { useForm } from '../hooks/useForm';
import { buildApiUrl } from '../lib/apiClient';
import { auth } from '../lib/firebase';
import './Dashboard.css';

export default function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [activeCaseId, setActiveCaseId] = useState(null);
  const [showSwitchPrompt, setShowSwitchPrompt] = useState(false);
  const [inviteTargetPlanId, setInviteTargetPlanId] = useState(null);

  const { state, dispatch } = useForm();

  // collaborationMode drives all invite UI:
  //   'locked-individual' — safety concern; hide all invite surfaces entirely
  //   'individual'        — user chose solo; show invite button with a switch prompt
  //   'collaborative'     — user chose collaborative; invite button works normally
  //   ''                  — not yet set (user hasn't completed Getting Started)
  const collaborationMode = state.collaborationMode ?? '';

  // Mock plan data — replace with real data fetching later
  const [plans, setPlans] = useState([]);

  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [contextMenu, setContextMenu] = useState(null);

  useEffect(() => {
    const close = () => setContextMenu(null);
    window.addEventListener('click', close);
    window.addEventListener('scroll', close);
    return () => { window.removeEventListener('click', close); window.removeEventListener('scroll', close); };
  }, []);

  /*
    This function will be ran anytime the "user" object is updated.
    When the "user" object gets updated, make an API call to retrieve all plans owned by the user
    and use the setPlans() method call to update the plans object so they are shown in the dashboard
  */
  useEffect(() => {
    if (!user) return;
    user.getIdToken()
      .then((idToken) => {
        return fetch(buildApiUrl('/api/plan/all'), {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          }
        });
      })
      .then((res) => {
        if (!res.ok) {
          throw new Error("Failed to retrieve plans");
        }
        return res.json();
      })
      .then((data) => {
        setPlans(data);
      })
      .catch((err) => {
        console.error(err.message);
      });
  }, [user]);

  const handleContextMenu = (e, plan) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, plan });
  };

  const [deleteTarget, setDeleteTarget] = useState(null);

  const handleDeletePlan = (id) => {
    if (user) {
      user.getIdToken().then((idToken) => {
        fetch(buildApiUrl("api/plan/delete"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({userID: user.uid, pID: id})
        })
        .then( async (response) => {
          if (!response.ok) {
            console.error("Failed to delete plan: ", response.message)
          } else {
            setPlans(prev => prev.filter(plan => plan._id !== id));
            setDeleteTarget(null);
          }
        });
      })
      .catch((error) => {
        console.error("Couldn't retrieve session token: ", error.message)
      });
    }
  };

  const startEditing = (plan) => {
    setEditingId(plan._id);
    setEditingName(plan.name);
  };

  const commitEdit = (id) => {
    const trimmed = editingName.trim();
    if (!trimmed) { setEditingId(null); return; }
    setPlans(prev => prev.map(p => p._id === id ? { ...p, name: trimmed } : p));
    setEditingId(null);
    user.getIdToken().then((idToken) => {
      fetch(buildApiUrl(`api/plan/${id}/name`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ name: trimmed }),
      }).catch(e => console.error('Failed to save plan name', e));
    });
  };

  const handleNewPlan = async () => {
    if (user) {
      user.getIdToken().then((idToken) => {
        fetch(buildApiUrl("api/plan/"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          }
        })
        .then( async (response) => {
          if (!response.ok) {
            console.error("Failed to create plan: ", response.message)
          } else {
            const plan = await response.json()
            setPlans(prev => [...prev, plan]);
            dispatch({ type: 'RESET' });
            dispatch({ type: 'UPDATE_SECTION', section: 'plan', payload: plan });
            if (plan.caseId) setActiveCaseId(plan.caseId);
          }
        });
      })
      .catch((error) => {
        console.error("Couldn't retrieve session token: ", error.message)
      });
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) navigate('/signin');
    });
    return unsubscribe;
  }, [navigate]);

  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      return undefined;
    }

    let active = true;
    setIsAdmin(false);
    user.getIdToken()
      .then((idToken) => fetch(buildApiUrl('/api/admin/access'), {
        headers: { Authorization: `Bearer ${idToken}` }
      }))
      .then((response) => {
        if (active && response.ok) {
          setIsAdmin(true);
        } else if (active && response.status !== 403) {
          console.error('Could not check administrator access');
        }
      })
      .catch((error) => {
        if (active) console.error('Could not check administrator access:', error);
      });

    return () => {
      active = false;
    };
  }, [user]);

  const handleSignOut = async () => {
    dispatch({ type: 'RESET' });
    localStorage.removeItem('sharedCareForm');
    await signOut(auth);
    navigate('/');
  };

  // Called when user clicks any invite button.
  // Routes based on current collaborationMode.
  const handleInviteClick = (plan) => {
    const planMode = plan.collaborationMode ?? '';

    setInviteTargetPlanId(plan._id);
    if (planMode === 'collaborative') {
      // Already in collaborative mode — open invite directly
      setIsInviteOpen(true);
    } else if (planMode === 'individual' || planMode === '') {
      // Ask users who chose individual mode or have not selected a mode yet
      // before switching to collaborative mode.
      setShowSwitchPrompt(true);
    }
    // 'locked-individual' — button is not rendered at all, so this is unreachable
  };

  // User confirmed they want to switch from individual to collaborative mode.
  const handleConfirmSwitch = async () => {
    if (!user || !inviteTargetPlanId) return;

    try {
      const idToken = await user.getIdToken();
      const response = await fetch(buildApiUrl(`api/plan/setCollabMode/${inviteTargetPlanId}`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ mode: 'collaborative' }),
      });

      if (!response.ok) throw new Error('Failed to set plan collaboration mode');

      setPlans(prev => prev.map(plan => (
        plan._id === inviteTargetPlanId
          ? { ...plan, collaborationMode: 'collaborative' }
          : plan
      )));
      dispatch({ type: 'UPDATE_SECTION', section: 'collaborationMode', payload: 'collaborative' });
      setShowSwitchPrompt(false);
      setIsInviteOpen(true);
    } catch (error) {
      console.error('Failed to switch plan to collaborative mode:', error.message);
    }
  };

  // Whether to show any invite surface at all
  const showInviteUI = collaborationMode !== 'locked-individual';

  return (
    <div className="dashboard" onClick={() => setContextMenu(null)}>
      <Header user={user} onSignOut={handleSignOut} />
      <InviteModal
        isOpen={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
        caseId={activeCaseId}
      />

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="delete-modal__overlay" onClick={() => setDeleteTarget(null)}>
          <div className="delete-modal" onClick={e => e.stopPropagation()}>
            <h3 className="delete-modal__title">Delete plan?</h3>
            <p className="delete-modal__body">
              Are you sure you want to delete <strong>"{deleteTarget.name}"</strong>? This action cannot be undone.
            </p>
            <div className="delete-modal__actions">
              <button className="delete-modal__cancel" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="delete-modal__confirm" onClick={() => handleDeletePlan(deleteTarget._id)}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Switch-to-collaborative confirmation prompt */}
      {showSwitchPrompt && (
        <div className="delete-modal__overlay" onClick={() => setShowSwitchPrompt(false)}>
          <div className="delete-modal" onClick={e => e.stopPropagation()}>
            <h3 className="delete-modal__title">Switch to collaborative mode?</h3>
            <p className="delete-modal__body">
              You're currently completing this plan individually. Switching to collaborative mode
              will allow your co-parent to fill out their section separately. Would you like to switch?
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

      {contextMenu && (
        <ul
          className="context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={e => e.stopPropagation()}
        >
          <li onClick={() => { startEditing(contextMenu.plan); setContextMenu(null); }}>
            <Pencil size={14} /> Rename
          </li>
          <li className="context-menu__delete" onClick={() => { setDeleteTarget(contextMenu.plan); setContextMenu(null); }}>
            <Trash2 size={14} /> Delete
          </li>
        </ul>
      )}

      <main className="dashboard__main">

        {/* Invite co-parent banner — hidden entirely for locked-individual users */}
        {showInviteUI && (
          <div className="dashboard__invite-banner">
            <div className="dashboard__invite-icon">
              <Users size={32} color="#14abdd" />
            </div>

            <div className="dashboard__invite-text">
              {collaborationMode === 'individual' ? (
                <>
                  <h2 className="dashboard__invite-title">You're working individually</h2>
                  <p className="dashboard__invite-description">
                    You chose to complete this plan on your own. If you'd like your co-parent to
                    contribute, you can switch to collaborative mode at any time.
                  </p>
                </>
              ) : (
                <>
                  <h2 className="dashboard__invite-title">Co-parenting works better together</h2>
                  <p className="dashboard__invite-description">
                    Invite the other parent to contribute to the plan. You'll both fill out your
                    preferences independently, and we'll help you find common ground.
                  </p>
                </>
              )}
            </div>
          </div>
        )}

        {/* Your Plans section */}
        <section className="dashboard__plans">
          <div className="dashboard__plans-header">
            <h2 className="dashboard__plans-title">Your Plans</h2>
            <div className="dashboard__plans-actions">
              {isAdmin && (
                <Link className="dashboard__admin-btn" to="/admin">
                  <Lock size={16} />
                  Admin View
                </Link>
              )}
              <button className="dashboard__new-plan-btn" onClick={handleNewPlan}>
                <Plus size={16} />
                New Plan
              </button>
            </div>
          </div>

          <div className="dashboard__plans-grid">
            {plans.map((plan) => {
              const planCollaborationMode = plan.collaborationMode ?? '';

              return (
                <div key={plan._id} className={`plan-card${plan.isShared ? ' plan-card--shared' : ''}`} onContextMenu={e => handleContextMenu(e, plan)}>
                <div className="plan-card__top">
                  <div className="plan-card__icon">
                    <FileText size={24} color="#6b7280" />
                  </div>
                  {plan.isShared && (
                    <span className="plan-card__shared-badge">
                      <Users size={12} /> Shared
                    </span>
                  )}
                  <button className="plan-card__delete-btn" onClick={() => setDeleteTarget(plan)}>
                    <Trash2 size={16} />
                  </button>
                </div>

                <div className="plan-card__name-row">
                  {editingId === plan._id ? (
                    <input
                      className="plan-card__name-input"
                      value={editingName}
                      onChange={e => setEditingName(e.target.value)}
                      onBlur={() => commitEdit(plan._id)}
                      onKeyDown={e => e.key === 'Enter' && commitEdit(plan._id)}
                      autoFocus
                    />
                  ) : (
                    <>
                      <h3 className="plan-card__name">{plan.name}</h3>
                      <button className="plan-card__edit-btn" onClick={() => startEditing(plan)}>
                        <Pencil size={14} />
                      </button>
                    </>
                  )}
                </div>

                <div className="plan-card__meta">
                  <Calendar size={14} color="#9ca3af" />
                  <span>Last modified: {plan.lastModified}</span>
                </div>
                {(() => {
                    if (plan.currentQuestion) { // maybe use status field of plan for this?
                      return (
                        <button
                          className="plan-card__open-btn"
                          onClick={() => {
                            dispatch({ type: 'RESET' });
                            dispatch({ type: 'UPDATE_SECTION', section: "plan", payload: plan });
                            dispatch({ type: 'UPDATE_SECTION', section: "collaborationMode", payload: plan.collaborationMode ?? '' });
                            dispatch({ type: 'UPDATE_SECTION', section: "timeAndCommunication", payload: plan.parentingTimeAndCommunication ?? {} });
                            dispatch({ type: 'UPDATE_SECTION', section: "informationSharing", payload: plan.informationSharing ?? {} });
                            dispatch({ type: 'UPDATE_SECTION', section: "taxExemptions", payload: plan.taxExemptions ?? {} });
                            dispatch({ type: 'UPDATE_SECTION', section: "parents", payload: {
                              firstName: plan.parentFName,
                              lastName: plan.parentLName,
                              age: plan.parentAge,
                              phone: plan.phoneNumber ?? plan.phone,
                              streetAddress: plan.streetAddress,
                              addressLine2: plan.addressLine2,
                              city: plan.city,
                              state: plan.state,
                              zipCode: plan.zipCode,
                            } });
                            dispatch({ type: 'UPDATE_SECTION', section: "parentingGuideInfo", payload: {} });
                            if (plan.caseId) setActiveCaseId(plan.caseId);
                            user.getIdToken().then((idToken) =>
                              fetch(buildApiUrl(`/api/plan/${plan._id}/current`), {
                                method: "GET",
                                headers: {
                                  "Content-Type": "application/json",
                                  Authorization: `Bearer ${idToken}`,
                                },
                              })
                            )
                            .then(res => {
                              if (!res.ok) {
                                throw new Error("Failed to retrieve current question");
                              }
                              return res.json();
                            })
                            .then(({ question }) => {
                              if (!question) {
                                navigate('/getting-started');
                                return;
                              }
                              dispatch({ type: 'UPDATE_SECTION', section: "question", payload: question });
                              if (question.section === "health-insurance-coverage") {
                                // this is temporary until there is frontend page for health-insurance-coverage
                                navigate("/parental-rights");
                                return;
                              }
                              navigate('/' + question.section);
                            })
                            .catch(error => console.error(error.message));
                          }}
                        >
                          Resume Plan &rarr;
                        </button>
                      );
                    } else {
                      return (
                        <button
                          className="plan-card__open-btn"
                          onClick={() => {
                            dispatch({ type: 'RESET' });
                            // Replace plan in context with the selected plan
                            dispatch({ type: 'UPDATE_SECTION', section: "plan", payload: plan });
                            dispatch({ type: 'UPDATE_SECTION', section: "collaborationMode", payload: plan.collaborationMode ?? '' });
                            dispatch({ type: 'UPDATE_SECTION', section: "timeAndCommunication", payload: plan.parentingTimeAndCommunication ?? {} });
                            dispatch({ type: 'UPDATE_SECTION', section: "informationSharing", payload: plan.informationSharing ?? {} });
                            dispatch({ type: 'UPDATE_SECTION', section: "taxExemptions", payload: plan.taxExemptions ?? {} });
                            // Clear stale question state from a previous session so the new plan starts fresh
                            dispatch({ type: 'UPDATE_SECTION', section: "question", payload: {} });
                            dispatch({ type: 'UPDATE_SECTION', section: "parentingGuideInfo", payload: {} });
                            dispatch({ type: 'UPDATE_SECTION', section: "parents", payload: {
                              firstName: plan.parentFName,
                              lastName: plan.parentLName,
                              age: plan.parentAge,
                              phone: plan.phoneNumber ?? plan.phone,
                              streetAddress: plan.streetAddress,
                              addressLine2: plan.addressLine2,
                              city: plan.city,
                              state: plan.state,
                              zipCode: plan.zipCode,
                            } });
                            if (plan.caseId) setActiveCaseId(plan.caseId);
                            navigate('/getting-started')
                          }}
                        >
                          Open Plan &rarr;
                        </button>
                      );
                    }
                })()}

                {/* Per-card invite button — hidden for locked-individual users */}
                {planCollaborationMode !== 'locked-individual' && !plan.isShared && (
                  <button className="plan-card__invite-btn" onClick={() => { setActiveCaseId(plan.caseId || null); handleInviteClick(plan); }}>
                  <UserPlus size={14} />
                    {planCollaborationMode === 'individual' || planCollaborationMode === '' ? 'Switch & Invite' : 'Invite Parent'}
                  </button>
                )}

                </div>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}