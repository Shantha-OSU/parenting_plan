import './Header.css';
import { useNavigate } from 'react-router-dom';
import { LogOut, Menu } from 'lucide-react';
import logo from '../../assets/logos/ShareCare_Symmetrical Diamond Logo (1120 x 310 px).png';

export default function Header({
  saved = false,
  user = null,
  onSignOut = null,
  onMenuToggle = null,
  isMenuOpen = false,
}) {
  const navigate = useNavigate();

  const handleLogoClick = () => {
    navigate('/dashboard');
  };

  return (
    <header className="header">
      <div className="header__top-bar">
        <button
          type="button"
          className="header__logo-button"
          onClick={handleLogoClick}
          aria-label="Go to dashboard"
        >
          <img
            src={logo}
            alt=""
            className="header__logo"
          />
        </button>

        <div className="header__right">
          {onMenuToggle && (
            <button
              type="button"
              className="header__menu-btn"
              onClick={onMenuToggle}
              aria-label={isMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={isMenuOpen}
            >
              <Menu size={22} />
            </button>
          )}

          {saved && (
            <div className="header__saved">
              <svg className="header__saved-icon" viewBox="0 0 16 16" fill="none">
                <path d="M13.5 4.5L6 12L2.5 8.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Saved
            </div>
          )}

          {user && (
            <div className="header__user">
              <span className="header__user-label">
                Logged in as <strong>{user.email}</strong>
              </span>
              {onSignOut && (
                <button className="header__signout-btn" onClick={onSignOut}>
                  <LogOut size={16} aria-hidden="true" />
                  Sign Out
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
