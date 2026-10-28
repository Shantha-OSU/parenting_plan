import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Sidebar from '../components/common/Sidebar';
import Header from '../components/common/Header';
import './Layout.css';
import Footer from '../components/common/Footer';
import { buildApiUrl } from '../lib/apiClient';
import { useForm } from '../hooks/useForm';
import { auth } from '../lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { useNavigation } from '../context/NavigationContext';

export default function Layout({ children }) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [saved, setSaved] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const { state, dispatch } = useForm();
  const plan = state.plan
  const q = state.question
  const parents = state.parents
  const answer = state.currAnswer
  // Define the page navigation order
  const pageOrder = [
    '/getting-started',
    '/parental-rights',
    '/parenting-time-communication',
    '/custody-schedule',
    '/transportation',
    '/informationsharing',
    '/tax-exemptions',
    '/review'
  ];

  const currentPageIndex = pageOrder.indexOf(location.pathname);
  const isFirstPage = currentPageIndex === 0;
  const isLastPage = currentPageIndex === pageOrder.length - 1;

  // Auto-collapse sidebar on mobile
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setIsSidebarCollapsed(true);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) navigate('/signin');
      else setUser(currentUser);
    });
    return unsubscribe;
  }, [navigate]);

  // Determine if current page should show navigation
  const shouldShowNavigation = pageOrder.includes(location.pathname);

  // Determine if current page should show header (not landing page)
  const shouldShowHeader = location.pathname !== '/';

  const toggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  const handleBack = async () => {
    try {
      if (user) {
        user.getIdToken().then((idToken) => { 
          const apiURL = '/api/plan/prevQuestion/' + q.qKey + '/' + plan._id
          // get the previous 'question' object
          fetch(buildApiUrl(apiURL), {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${idToken}`,
            }
          }).then( async (response) => {
            if (!response.ok) {
                throw new Error(`Response status: ${response.status}`);
            }
            response.json().then( data => {
              if (data === "none") {
                navigate("/getting-started")
                return
              }
              dispatch({
                type: 'UPDATE_SECTION',
                section: "question",
                payload: data
              });
              if (data.section === "health-insurance-coverage") {
                // this is temporary until there is frontend page for health-insurance-coverage
                navigate("/parental-rights");
                return
              }
              navigate("/" + data.section);
            })
          })
        })
      }
    } catch (e) {
        console.error(e.message)
    }
  };

  function gettingStartedNext(idToken) {
    // API call to update collab mode
    fetch(buildApiUrl("api/plan/setCollabMode/" + state.plan._id), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({mode: plan.collaborationMode})
    })
    .then( async (response) => {
      if (!response.ok) {
        console.error("Failed to update plan share mode: ", response.message)
      }
    })

    // API call to update plan with added children
    fetch(buildApiUrl('api/plan/' + plan._id + '/children'), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({planChildren: plan.children})
    })
    .then( async (response) => {
      if (!response.ok) {
        console.error("Failed to update plan children: ", response.message)
      }
      // api call to update plan with user's name, phone, address, and role in plan
      fetch(buildApiUrl('api/plan/' + plan._id + '/information'), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          parentFName: parents.firstName,
          parentLName: parents.lastName,
          parentAge: Number(parents.age),
          phone: parents.phone,
          streetAddress: parents.streetAddress,
          addressLine2: parents.addressLine2,
          city: parents.city,
          state: parents.state,
          zipCode: parents.zipCode,
          aggregateData: plan.aggregateData ?? {},
          currentCircumstance: plan.currentCircumstance,
          caseFilingStatus: plan.caseFilingStatus,
          courtCustodyOrderIssued: plan.courtCustodyOrderIssued,
          custodyGrantedTo: plan.custodyGrantedTo
      })
      })
      .then( async (response) => {
        if (!response.ok) {
          console.error("Failed to add contact info to user plan: ", response.message)
        }
        response.json().then( data => {
          dispatch({
            type: 'UPDATE_SECTION',
            section: "plan",
            payload: data
          })
        })
      })
    })
  }

  function questionnaireNext(idToken) {
    // update currentQuestion field in plan
    plan.currentQuestion = q._id

    // api call to set current question of plan to question just answered 
    fetch(buildApiUrl('api/plan/updateCurrent/' + plan._id + '/' + plan.currentQuestion), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      }
    })
    .then( async (response) => {
      if (!response.ok) {
        console.error("Failed to update plan: ", response.message)
      }
      // api call to update user's answer to current question in plan
      fetch(buildApiUrl('api/plan/' + plan._id + '/answer'), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({qKey: q.qKey, answer: answer})
      })
      .then( async (response) => {
        if (!response.ok) {
          console.error("Failed to add answer to user plan: ", response.message)
        }
        response.json().then( data => {
          dispatch({
            type: 'UPDATE_SECTION',
            section: "plan",
            payload: data
          })
        })
      })
    })
  }

  async function saveGettingStartedBeforeNavigation(idToken) {
    const saveRequest = async (url, body) => {
      const response = await fetch(buildApiUrl(url), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error || `Failed to save Getting Started data (${response.status})`);
      }
      return response.json();
    };

    await saveRequest(`api/plan/setCollabMode/${plan._id}`, {
      mode: plan.collaborationMode,
    });
    await saveRequest(`api/plan/${plan._id}/children`, {
      planChildren: plan.children,
    });
    const savedPlan = await saveRequest(`api/plan/${plan._id}/information`, {
      parentFName: parents.firstName,
      parentLName: parents.lastName,
      parentAge: Number(parents.age),
      phone: parents.phone,
      streetAddress: parents.streetAddress,
      addressLine2: parents.addressLine2,
      city: parents.city,
      state: parents.state,
      zipCode: parents.zipCode,
      aggregateData: plan.aggregateData ?? {},
      currentCircumstance: plan.currentCircumstance,
      caseFilingStatus: plan.caseFilingStatus,
      courtCustodyOrderIssued: plan.courtCustodyOrderIssued,
      custodyGrantedTo: plan.custodyGrantedTo,
    });
    dispatch({
      type: 'UPDATE_SECTION',
      section: 'plan',
      payload: savedPlan,
    });
  }

  async function saveQuestionBeforeNavigation(idToken) {
    const currentResponse = await fetch(
      buildApiUrl(`api/plan/updateCurrent/${plan._id}/${q._id}`),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
      },
    );
    if (!currentResponse.ok) {
      throw new Error(`Failed to update current question (${currentResponse.status})`);
    }

    const answerResponse = await fetch(buildApiUrl(`api/plan/${plan._id}/answer`), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ qKey: q.qKey, answer }),
    });
    if (!answerResponse.ok) {
      throw new Error(`Failed to save question answer (${answerResponse.status})`);
    }
    const savedPlan = await answerResponse.json();
    dispatch({
      type: 'UPDATE_SECTION',
      section: 'plan',
      payload: savedPlan,
    });
  }

  const handleSave = () => {
    if (!user) return;
    const isGettingStarted = location.pathname === '/getting-started';
    const hasValidAnswer = isGettingStarted || (q?.type === 'text input' ? String(answer ?? '').trim().length > 0 : q?.options && q.options.findIndex(qAnswer => qAnswer.value === answer) >= 0);
    if (!hasValidAnswer) return;
    user.getIdToken().then((idToken) => {
      if (isGettingStarted) {
        gettingStartedNext(idToken);
      } else {
        questionnaireNext(idToken);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  };

  const { onNext: pageOnNext, setOnNext, setOnBack } = useNavigation();

    useEffect(() => {
      setOnNext(null);
      setOnBack(null);
    }, [location.pathname, setOnNext, setOnBack]);

  const handleNext = async () => {
    if (pageOnNext) {
      const pageValidationResult = await pageOnNext();
      if (pageValidationResult !== true) return;
    }
    // prevent user from clicking next if answer is not selected
    const hasValidQuestionAnswer = q?.type === 'text input' ? String(answer ?? '').trim().length > 0 : q?.options && q.options.findIndex(qAnswer => qAnswer.value === answer) >= 0;
    if (pageOrder[currentPageIndex] !== '/getting-started' && !hasValidQuestionAnswer) {
      return;
    }
    try {
      if (!user || !plan?._id) {
        throw new Error('Sign in and select a plan before continuing.');
      }
      const idToken = await user.getIdToken();
      const isGettingStarted = pageOrder[currentPageIndex] === '/getting-started';
      if (isGettingStarted) {
        await saveGettingStartedBeforeNavigation(idToken);
      } else {
        await saveQuestionBeforeNavigation(idToken);
      }

      const response = await fetch(buildApiUrl('/api/logic-engine/nextQuestionWithContext'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(isGettingStarted
          ? { planId: plan._id, startQKey: 'allocation_parental_rights' }
          : { planId: plan._id, qKey: q.qKey, answer }),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error || `Failed to load next question (${response.status})`);
      }
      const data = await response.json();
      if (!data || !data.section) {
        const nextRoute = location.pathname === '/parental-rights'
          ? '/parenting-time-communication'
          : '/review';
        navigate(nextRoute);
        return;
      }
      dispatch({
        type: 'UPDATE_SECTION',
        section: 'question',
        payload: data,
      });
      if (data.section === 'health-insurance-coverage') {
        navigate('/parental-rights');
        return;
      }
      navigate(`/${data.section}`);
    } catch (e) {
      console.error('Could not navigate to the next question:', e);
    }
  };

  return (
    <div className="layout">
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        onToggle={toggleSidebar}
      />

      <div className={`layout__main ${isSidebarCollapsed ? 'layout__main--sidebar-collapsed' : ''}`}>
        {shouldShowHeader && (
          <Header
            showNavigation={false} // Navigation is now in sidebar
            saved={false} // You can pass saved state if needed
          />
        )}

        <main className="layout__content">
          {children}
        </main>

        <Footer
          showBackButton={!isFirstPage}
          showNextButton={!isLastPage}
          showSaveButton={shouldShowNavigation}
          onBack={handleBack}
          onNext={handleNext}
          onSave={handleSave}
          saved={saved}
        />
      </div>

    </div>
  );
}