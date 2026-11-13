import { Link } from 'react-router-dom';
import './StaticPage.css';
import { useEffect } from 'react';

export default function ContactSupport() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="static-page">
      <div className="static-page__container">
        <Link className="static-page__back" to="/">
          ← Back
        </Link>

        <h1 className="static-page__title">Contact Support</h1>

        {/* TODO: fill in contact details, form, or support channels */}
        <p className="static-page__placeholder">Contact Support content coming soon.</p>
      </div>
    </div>
  );
}
