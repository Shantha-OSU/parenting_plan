import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  FileCheck2,
  Heart,
  MessageCircle,
  ShieldCheck,
  UserRound,
  UserRoundPlus,
} from 'lucide-react';
import logo from '../assets/logos/ShareCare_Symmetrical Diamond Logo (1120 x 310 px).png';
import './HowItWorks.css';

const benefits = [
  'A step-by-step process that is easier to follow',
  'A child-focused approach to everyday decisions',
  'Private responses until both parents are ready to compare',
  'A clear summary of agreements and differences',
];

export default function HowItWorks() {
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="how-it-works">
      <div className="how-it-works__pattern" aria-hidden="true" />

      <header className="how-it-works__header">
        <button
          className="how-it-works__logo-link"
          onClick={() => navigate('/')}
          aria-label="Return to ShareCare home"
        >
          <img src={logo} alt="ShareCare" />
        </button>
        <div className="how-it-works__header-actions">
          <button className="how-it-works__sign-in" onClick={() => navigate('/signin')}>
            Sign In
          </button>
          <button className="how-it-works__header-cta" onClick={() => navigate('/signup')}>
            Get Started
          </button>
        </div>
      </header>

      <main>
        <section className="how-it-works__hero">
          <div className="how-it-works__eyebrow">
            <Heart size={17} fill="currentColor" aria-hidden="true" />
            Built for families
          </div>
          <h1>Simplifying parenting plan creation for all families</h1>
          <p>
            ShareCare is a free tool, guiding parents through the process of creating a thoughtful
            parenting plan—one step at a time, with your child(ren) at the center.
          </p>
          <button className="how-it-works__primary-cta" onClick={() => navigate('/signup')}>
            Create your plan
            <ArrowRight size={20} aria-hidden="true" />
          </button>
        </section>

        <section className="how-it-works__steps" aria-labelledby="steps-heading">
          <div className="how-it-works__section-heading">
            <p className="how-it-works__eyebrow">The process</p>
            <h2 id="steps-heading">Choose the path that works for your family</h2>
            <p>Start with your plan, then decide whether you want to finish on your own or collaborate.</p>
          </div>
          <div className="how-it-works__process">
            <article className="how-it-works__step how-it-works__step--blue">
              <div className="how-it-works__step-top">
                <div className="how-it-works__step-icon"><FileText size={25} aria-hidden="true" /></div>
                <span>01</span>
              </div>
              <h3>Start your plan</h3>
              <p>Answer clear, guided questions about your child(ren)’s schedule, care, school, health, and day-to-day needs.</p>
            </article>

            <div className="how-it-works__path-intro">
              <span>Then choose the path that works for you</span>
            </div>

            <div className="how-it-works__paths">
              <div className="how-it-works__path how-it-works__path--solo">
                <div className="how-it-works__path-title">
                  <UserRound size={20} aria-hidden="true" />
                  <span>Path A: Complete it on your own</span>
                </div>
                <article className="how-it-works__step how-it-works__step--purple">
                  <div className="how-it-works__step-top">
                    <div className="how-it-works__step-icon"><UserRound size={25} aria-hidden="true" /></div>
                    <span>02A</span>
                  </div>
                  <h3>Complete it on your own</h3>
                  <p>Finish your plan independently of your co-parent.</p>
                </article>
                <div className="how-it-works__path-arrow" aria-hidden="true">↓</div>
                <article className="how-it-works__step how-it-works__step--orange">
                  <div className="how-it-works__step-top">
                    <div className="how-it-works__step-icon"><FileCheck2 size={25} aria-hidden="true" /></div>
                    <span>03A</span>
                  </div>
                  <h3>Generate your completed plan</h3>
                  <p>Generate a court-ready plan centered on your child(ren) based on your responses.</p>
                </article>
              </div>

              <div className="how-it-works__path how-it-works__path--co-parent">
                <div className="how-it-works__path-title">
                  <UserRoundPlus size={20} aria-hidden="true" />
                  <span>Path B: Work with your co-parent</span>
                </div>
                <article className="how-it-works__step how-it-works__step--green">
                  <div className="how-it-works__step-top">
                    <div className="how-it-works__step-icon"><UserRoundPlus size={25} aria-hidden="true" /></div>
                    <span>02B</span>
                  </div>
                  <h3>Invite your co-parent</h3>
                  <p>Share a private invitation so your co-parent can fill out their own form.</p>
                </article>
                <div className="how-it-works__path-arrow" aria-hidden="true">↓</div>
                <article className="how-it-works__step how-it-works__step--orange">
                  <div className="how-it-works__step-top">
                    <div className="how-it-works__step-icon"><MessageCircle size={25} aria-hidden="true" /></div>
                    <span>03B</span>
                  </div>
                  <h3>Compare and agree</h3>
                  <p>Use the automatic comparison tool to see where agreements and disagreements are between plans. Easily send resolutions to your co-parent allowing for faster collaboration. Finalize agreements and mark any remaining disagreements for future discussion.</p>
                </article>
                <div className="how-it-works__path-arrow" aria-hidden="true">↓</div>
                <article className="how-it-works__step how-it-works__step--purple">
                  <div className="how-it-works__step-top">
                    <div className="how-it-works__step-icon"><FileCheck2 size={25} aria-hidden="true" /></div>
                    <span>04B</span>
                  </div>
                  <h3>Generate your completed plan</h3>
                  <p>Generate a court-ready plan centered on your child(ren) and your co-parent’s shared decisions.</p>
                </article>
              </div>
            </div>
          </div>
        </section>

        <section className="how-it-works__support">
          <div className="how-it-works__support-copy">
            <h2>A calmer way to plan for what matters most.</h2>
            <p>
              You do not have to figure everything out at once. ShareCare helps
              organize the details, surface the important conversations, and keep
              decisions focused on your child(ren)’s well-being.
            </p>
            <ul>
              {benefits.map((benefit) => (
                <li key={benefit}>
                  <CheckCircle2 size={19} aria-hidden="true" />
                  {benefit}
                </li>
              ))}
            </ul>
          </div>
          <div className="how-it-works__support-card">
            <Heart size={34} aria-hidden="true" />
            <h3>Putting the family first.</h3>
            <p>
              Every part of the experience is designed to help you build a plan
              that supports your family’s unique needs.
            </p>
          </div>
        </section>

        <section className="how-it-works__bottom-cta">
          <h2>Ready to take the first step?</h2>
          <p>Start building a parenting plan that works for your family.</p>
          <button className="how-it-works__primary-cta" onClick={() => navigate('/signup')}>
            Get started for free
            <ArrowRight size={20} aria-hidden="true" />
          </button>
        </section>
      </main>

      <footer className="how-it-works__footer">
        <span>&copy; 2026 Action for Children. All rights reserved.</span>
        <div>
          <button onClick={() => navigate('/privacy-policy')}>Privacy Policy</button>
          <button onClick={() => navigate('/terms-of-service')}>Terms of Service</button>
          <button onClick={() => navigate('/contact-support')}>Contact Support</button>
        </div>
      </footer>
    </div>
  );
}
