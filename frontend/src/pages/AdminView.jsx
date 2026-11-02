import { onAuthStateChanged } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import UserData from './UserData';
import { auth } from '../lib/firebase';
import { buildApiUrl } from '../lib/apiClient';
import './AdminView.css';

export default function AdminView() {
  const navigate = useNavigate();
  const [access, setAccess] = useState('checking');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        navigate('/signin', { replace: true });
        return;
      }

      setAccess('checking');
      setError('');
      try {
        const idToken = await currentUser.getIdToken();
        const response = await fetch(buildApiUrl('/api/admin/access'), {
          headers: { Authorization: `Bearer ${idToken}` }
        });

        if (!active) return;
        if (response.status === 403) {
          setAccess('denied');
          return;
        }
        if (!response.ok) {
          throw new Error('Could not verify administrator access');
        }

        setAccess('allowed');
      } catch (accessError) {
        if (active) {
          setError(accessError.message);
          setAccess('error');
        }
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [navigate]);

  if (access === 'checking') {
    return <main className="admin-view" aria-busy="true"><p>Checking administrator access...</p></main>;
  }

  if (access === 'denied') {
    return (
      <main className="admin-view">
        <p className="admin-view__message" role="alert">Administrator access required.</p>
        <Link to="/dashboard">Return to dashboard</Link>
      </main>
    );
  }

  if (access === 'error') {
    return (
      <main className="admin-view">
        <p className="admin-view__message" role="alert">{error}</p>
      </main>
    );
  }

  return (
    <div className="admin-view">
      <header className="admin-view__header">
        <div>
          <h1>Admin View</h1>
        </div>
        <nav className="admin-view__actions" aria-label="Admin navigation">
          <Link className="admin-view__link" to="/form-designer">Customize PDF form</Link>
          <Link className="admin-view__link" to="/admin/questions">Edit questions</Link>
          <Link className="admin-view__link" to="/dashboard">Back to dashboard</Link>
        </nav>
      </header>
      <UserData />
    </div>
  );
}
