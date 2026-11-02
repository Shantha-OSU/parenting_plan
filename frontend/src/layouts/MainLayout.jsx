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
          userRole: plan.userRole,
          residentialParent: plan.residentialParent
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
          dispatch({
            type: 'UPDATE_SECTION',
            section: 'parental_rights',
            payload: {
              responses: (data.answers ?? []).map(({ qKey, answer }) => ({ qKey, answer })),
            },
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
        body: JSON.stringify({qKey: q.qKey, answer})
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
    const hasValidQuestionAnswer = q?.type === 'text input'
        ? String(answer ?? '').trim().length > 0
        : q?.options && q.options.findIndex(qAnswer => qAnswer.value === answer) >= 0;
    if (pageOrder[currentPageIndex] !== '/getting-started' && !hasValidQuestionAnswer) {
      return;
    }
    const navigationAnswer = answer;
    const apiURL = pageOrder[currentPageIndex] === '/getting-started'
      ? '/api/logic-engine/question/allocation_parental_rights' // default starting question (probably change to const or something)
: '/api/logic-engine/nextQuestion/' + encodeURIComponent(q.qKey) + '/' + encodeURIComponent(navigationAnswer)
    try {
      // get the next 'question' object
      const response = await fetch(buildApiUrl(apiURL));
      if (!response.ok) {
          throw new Error(`Response status: ${response.status}`);
      }
      if (user) {
        user.getIdToken().then((idToken) => { 
          if (pageOrder[currentPageIndex] === "/getting-started") {
            gettingStartedNext(idToken)
          } else {
            questionnaireNext(idToken)
          }
        })
      }
      response.json().then( data => {
        // If the logic engine returns nothing, the questionnaire is complete.
        // Small delay so the answer save (questionnaireNext) has time to finish
        // before we navigate away — both are fire-and-forget parallel chains.
        if (!data || !data.section) {
          const nextRoute = location.pathname === '/parental-rights'
            ? '/parenting-time-communication'
            : '/review';
          setTimeout(() => navigate(nextRoute), 600);
          return;
        }
        // Otherwise advance to the next question's section route.
        dispatch({
          type: 'UPDATE_SECTION',
          section: "question",
          payload: data
        });
        // temporary solution until frontend page for health-insurance-coverage is made
        // until then, display health insurance coverage questions in parental-rights page
        if (data.section === "health-insurance-coverage") {
          navigate("/parental-rights")
          return
        }
        navigate("/" + data.section);
      })
    } catch (e) {
        console.error(e.message)
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