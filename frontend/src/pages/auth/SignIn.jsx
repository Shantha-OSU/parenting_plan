import { signInWithEmailAndPassword } from 'firebase/auth';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import logo from '../../assets/logos/ShareCare_Symmetrical Diamond Logo (1120 x 310 px).png';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/common/card';
import TextInput from '../../components/forms/TextInput';
import { useForm } from '../../hooks/useForm';
import { syncFirebaseUserProfileSafely } from '../../lib/authApi';
import { auth } from '../../lib/firebase';
import '../Page.css';
import './Auth.css';

export default function SignIn() {
  const navigate = useNavigate();
  const { dispatch } = useForm();
  const redirect = new URLSearchParams(window.location.search).get('redirect');

  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);

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

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (validateForm()) {
      setIsLoading(true);
      try {
        // Sign in the user in Firebase Auth with email + password
        const userCredential = await signInWithEmailAndPassword(auth, formData.email, formData.password);

        // Try to sync Mongo profile, but do not block sign-in if backend/database is down.
        await syncFirebaseUserProfileSafely(userCredential.user);

        // Clear any stale form state from a previous user's session
        dispatch({ type: 'RESET' });
        localStorage.removeItem('sharedCareForm');
        // Next Step
        navigate(redirect || '/dashboard');
      } catch (err) {
        // Show Firebase error in the form
        setErrors({ general: 'Invalid email or password, please check both and try again.' });
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="auth-page">
      <header className="auth-top-nav">
        <Link to="/" className="auth-top-nav__logo" aria-label="Return to ShareCare home">
          <img src={logo} alt="ShareCare" />
        </Link>
        <Link to="/how-it-works" className="auth-top-nav__link">
          How it works
        </Link>
      </header>

      <div className="auth-container">
        <Card className="auth-card">
          <CardHeader>
            <CardTitle>Welcome Back</CardTitle>
            <CardDescription>Sign in to continue to your parenting plan</CardDescription>
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
                placeholder="Enter your password"
                autoComplete="current-password"
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
                {isLoading ? 'Signing in...' : 'Sign In'}
              </button>

              <div className="auth-footer">
                <p>
                  Don't have an account?{' '}
                  <Link to="/signup" className="auth-link">
                    Sign up
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
