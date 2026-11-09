import { useNavigate } from 'react-router-dom';
import { FileText, Heart, Users, ArrowRight, Shield, CheckCircle2 } from 'lucide-react';
import './LandingPage.css';
import logo from '../assets/logos/ShareCare_Symmetrical Diamond Logo (1120 x 310 px).png';

export default function LandingPage() {
  const navigate = useNavigate();

  const handleGetStarted = () => {
    navigate('/signup');
  };

  const handleSignIn = () => {
    navigate('/signin');
  };

  return (
    <div className="landing-page">
      {/* Safety Resource Banner */}
      <div className="safety-banner">
        <div className="safety-banner__content">
            <div className="safety-banner__icon safety-banner__icon--red">
              <Shield size={24} aria-hidden="true" />
            </div>
          <span>
            <strong>Safety Resources:</strong> If you or your children are experiencing domestic violence or abuse,
            please contact the National Domestic Violence Hotline at 1-800-799-7233.
          </span>
        </div>
      </div>

      {/* Header */}
      <header className="landing-header">
        <div className="landing-header__container">
          <div className="landing-header__logo-section">
            <img src={logo} alt="ShareCare" className="landing-header__logo" />
          </div>
          <div className="landing-header__actions">
            <button onClick={() => navigate('/how-it-works')} className="landing-header__link">How it works</button>
            <button onClick={handleSignIn} className="landing-header__sign-in">Sign In</button>
            <button onClick={handleGetStarted} className="landing-header__cta">
              Get Started
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="landing-main">
        <section className="hero">
          <h1 className="hero__title">
            Create Your <br />
            <span className="hero__title-accent">Parenting Plan</span>
          </h1>

          <p className="hero__description">
            A step-by-step guide to help you create a comprehensive co-parenting plan that puts your children first.
          </p>

          {/* Feature Cards */}
          <div className="feature-cards">
            <div className="feature-card_left">
              <FileText className="feature-card_left__icon-bg" size={80} aria-hidden="true" />
              <FileText className="feature-card_left__icon" size={32} aria-hidden="true" />
              <h3 className="feature-card__title">Guided Process</h3>
              <p className="feature-card__description">Simple questions walk you through each section.</p>
            </div>

            <div className="feature-card_center">
              <Heart className="feature-card_center__icon-bg" size={80} aria-hidden="true" />
              <Heart className="feature-card_center__icon" size={32} aria-hidden="true" />
              <h3 className="feature-card__title">Child-Focused</h3>
              <p className="feature-card__description">Designed to prioritize your child's well-being.</p>
            </div>

            <div className="feature-card_right">
              <Users className="feature-card_right__icon-bg" size={80} aria-hidden="true" />
              <Users className="feature-card_right__icon" size={32} aria-hidden="true" />
              <h3 className="feature-card__title">Work Together</h3>
              <p className="feature-card__description">Invite the other parent to collaborate and agree.</p>
            </div>
          </div>

          <div className="hero__cta-section">
            <button onClick={handleGetStarted} className="hero__cta-button">
              Begin Your Plan
              <ArrowRight size={24} aria-hidden="true" />
            </button>

            {/* Important Notice Box */}
            <div className="notice-box">
              <div>
                <h4 className="notice-box__title">Important Notice</h4>
                <p className="notice-box__text">
                  This tool helps you create a draft parenting plan. It is <strong>not legal advice</strong> and does not create a legally binding agreement.
                  Your plan must be reviewed and approved by the court to become legally enforceable. If you have questions about your specific situation,
                  please consult with an attorney.
                </p>
              </div>
            </div>
          </div>  
        </section>

        {/* Value Props Section */}
        <section className="value-props">
          <div className="value-props__container">
            <div className="value-props__content">
              <h2 className="value-props__title">Why use our tool?</h2>
              <div className="value-props__list">
                <div className="value-prop">
                  <div className="value-prop__icon value-prop__icon--blue">
                    <Shield size={24} aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="value-prop__title">Court Ready Format</h3>
                    <p className="value-prop__description">
                      We generate documents that align with standard court requirements, saving you time and formatting headaches.
                    </p>
                  </div>
                </div>

                <div className="value-prop">
                  <div className="value-prop__icon value-prop__icon--green">
                    <CheckCircle2 size={24} aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="value-prop__title">Free & Accessible</h3>
                    <p className="value-prop__description">
                      Access professional-grade tools without the high costs. We believe every family deserves support.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="value-props__visual">
              <div className="mockup">
                <div className="mockup__header">
                  <div className="mockup__dot mockup__dot--red"></div>
                  <div className="mockup__dot mockup__dot--yellow"></div>
                  <div className="mockup__dot mockup__dot--green"></div>
                </div>
                <div className="mockup__content">
                  <div className="mockup__line mockup__line--75"></div>
                  <div className="mockup__line mockup__line--100"></div>
                  <div className="mockup__document">
                    <FileText size={48} aria-hidden="true" />
                  </div>
                  <div className="mockup__line mockup__line--66"></div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="landing-footer__container">
          <p className="landing-footer__copyright">&copy; 2026 Action for Children. All rights reserved.</p>
          <div className="landing-footer__links">
            <button className="landing-footer__link" onClick={() => navigate('/privacy-policy')}>Privacy Policy</button>
            <button className="landing-footer__link" onClick={() => navigate('/terms-of-service')}>Terms of Service</button>
            <button className="landing-footer__link" onClick={() => navigate('/contact-support')}>Contact Support</button>
          </div>
        </div>
      </footer>
    </div>
  );
}
