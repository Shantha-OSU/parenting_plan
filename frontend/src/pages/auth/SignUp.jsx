import { createUserWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import logo from '../../assets/logos/ShareCare_Symmetrical Diamond Logo (1120 x 310 px).png';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/common/card';
import LegalNoticeModal from '../../components/common/LegalNoticeModal';
import TextInput from '../../components/forms/TextInput';
import { useForm } from '../../hooks/useForm';
import { syncFirebaseUserProfileSafely } from '../../lib/authApi';
import { auth } from '../../lib/firebase';
import '../Page.css';
import './Auth.css';

export default function SignUp() {
  const navigate = useNavigate();
  const { dispatch } = useForm();
  const redirect = new URLSearchParams(window.location.search).get('redirect');

  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [showLegalNotice, setShowLegalNotice] = useState(false);

  const handleChange = (field) => (value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
    }

    if (!formData.password.trim()) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // On submit: only validate and show the modal — no Firebase call yet
  const handleSubmit = (e) => {
    e.preventDefault();
    if (validateForm()) {
      setShowLegalNotice(true);
    }
  };

  // User accepted all terms — NOW create the Firebase account
  const handleLegalAccept  = async (e) => {
    setShowLegalNotice(false);
    setIsLoading(true);
      try {
        // Create the user in Firebase Auth with email + password
        const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
        const firebaseUser = userCredential.user;

        // Send Firebase's built-in verification email after account creation.
        await sendEmailVerification(firebaseUser);

        // Try to sync Mongo profile, but do not block sign-up if backend/database is down.
        await syncFirebaseUserProfileSafely(firebaseUser);

        // New accounts start from the dashboard, where they can create a plan.
        dispatch({ type: 'RESET' });
        localStorage.removeItem('sharedCareForm');
        navigate(redirect || '/dashboard');
      } catch (err) {
        // Show Firebase error in the form
        setErrors({ general: 'Email already in use, please use a different email address.' });
      } finally {
        setIsLoading(false);
      }
  };

  // User closed the modal — just hide it, no account was created
  const handleLegalClose = () => {
    setShowLegalNotice(false);
  };

  return (
    <main className="auth-page">
      <LegalNoticeModal
        isOpen={showLegalNotice}
        onAccept={handleLegalAccept}
        onClose={handleLegalClose}
      />
      
      <div className="auth-container">
        <div className="auth-logo">
          <img src={logo} alt="ShareCare" />
        </div>

        <Card className="auth-card">
          <CardHeader>
            <CardTitle>Welcome!</CardTitle>
            <CardDescription>Sign up to create your parenting plan</CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} noValidate>
              <TextInput
                id="email"
                label="Email"
                type="email"
                value={formData.email}
                onChange={handleChange('email')}
                required
                error={errors.email}
                placeholder="you@example.com"
                autoComplete="email"
              />

              <TextInput
                id="password"
                label="Password"
                type="password"
                value={formData.password}
                onChange={handleChange('password')}
                required
                error={errors.password}
                placeholder="Enter a password"
                autoComplete="new-password"
              />

              <div className="auth-options">
                <Link to="/forgot-password" className="auth-link">
                  Forgot password?
                </Link>
              </div>

              {errors.general && (
                <p role="alert" className="text-red-600 text-sm mb-4">
                  {errors.general}
                </p>
              )}

              <button
                type="submit"
                className="auth-button"
                disabled={isLoading}
              >
                {isLoading ? 'Creating account...' : 'Sign Up'}
              </button>

              <div className="auth-footer">
                <p>
                  Already have an account?{' '}
                  <Link to="/signin" className="auth-link">
                    Sign in
                  </Link>
                </p>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="auth-back">
          <Link to="/" className="auth-link">
            ← Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}
