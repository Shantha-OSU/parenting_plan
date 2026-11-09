import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { buildApiUrl } from '../lib/apiClient';
import { Clock, CheckCircle } from 'lucide-react';
import './WaitingScreen.css';

const POLL_INTERVAL_MS = 15000;

function getConfig(status, isParent1) {
  if (status === 'comparison_ready' && !isParent1) {
    return {
      title: 'Waiting for Co-Parent',
      description: 'Your co-parent is reviewing the differences and proposing resolutions. You\'ll be notified when they\'re done.',
      step: 'Co-parent is resolving differences…',
    };
  }
  if (status === 'resolutions_pending' && isParent1) {
    return {
      title: 'Resolutions Sent',
      description: 'Your proposed resolutions have been sent to your co-parent for review. You\'ll be notified once they respond.',
      step: 'Co-parent is reviewing your proposed resolutions…',
    };
  }
  if (status === 'resolutions_reviewed' && !isParent1) {
    return {
      title: 'Feedback Sent',
      description: 'Your feedback has been sent. Your co-parent is doing a final review of the items you flagged.',
      step: 'Co-parent is reviewing your feedback…',
    };
  }
  // Fallback
  return {
    title: 'Please Wait',
    description: 'Waiting for the next step to become available.',
    step: 'Processing…',
  };
}

export default function WaitingScreen() {
  const { caseId } = useParams();
  const navigate = useNavigate();

  const [status, setStatus] = useState(null);
  const [isParent1, setIsParent1] = useState(false);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef(null);

  const checkAndRedirect = (currentStatus, parent1) => {
    // Navigate away if no longer in a waiting state
    if (currentStatus === 'resolutions_pending' && !parent1) {
      navigate(`/resolution-review/${caseId}`);
    } else if (currentStatus === 'resolutions_reviewed' || currentStatus === 'needs_discussion' || currentStatus === 'resolved') {
      navigate(`/comparison/${caseId}`);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const poll = async (user) => {
      if (!user || !isMounted) return;
      try {
        const idToken = await user.getIdToken();
        const res = await fetch(buildApiUrl(`/api/v1/cases/${caseId}/status`), {
          headers: { Authorization: `Bearer ${idToken}` },
        });
        if (!res.ok || !isMounted) return;
        const data = await res.json();
        if (!isMounted) return;
        setStatus(data.status);
        setIsParent1(data.isParent1);
        setLoading(false);
        checkAndRedirect(data.status, data.isParent1);
      } catch {
        if (isMounted) setLoading(false);
      }
    };

    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) { navigate('/signin'); return; }
      poll(user);
      intervalRef.current = setInterval(() => poll(user), POLL_INTERVAL_MS);
    });

    return () => {
      isMounted = false;
      clearInterval(intervalRef.current);
      unsub();
    };
  }, [caseId, navigate]);

  if (loading) {
    return (
      <div className="waiting waiting--centered">
        <div className="waiting__spinner" />
        <p>Loading…</p>
      </div>
    );
  }

  const config = getConfig(status, isParent1);

  return (
    <div className="waiting waiting--centered">
      <div className="waiting__icon">
        <Clock size={52} color="#14abdd" aria-hidden="true" />
      </div>
      <h1 className="waiting__title">{config.title}</h1>
      <p className="waiting__description">{config.description}</p>

      <div className="waiting__status-row">
        <div className="waiting__spinner waiting__spinner--small" />
        <span className="waiting__step">{config.step}</span>
      </div>

      <p className="waiting__hint">This page checks for updates every 15 seconds automatically.</p>

      <button className="waiting__back-btn" onClick={() => navigate('/dashboard')}>
        <CheckCircle size={16} aria-hidden="true" />
        Back to Dashboard
      </button>
    </div>
  );
}
