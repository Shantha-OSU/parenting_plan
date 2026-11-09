import { Link, useLocation } from 'react-router-dom';
import { ChevronLeftIcon, ChevronRightIcon, UserIcon, CalendarIcon, CarIcon, CheckCircleIcon, LayoutDashboard, ShareIcon, ReceiptIcon } from 'lucide-react';
import './Sidebar.css';

export default function Sidebar({ isCollapsed, onToggle }) {
  const location = useLocation();

  const navItems = [
    { path: '/getting-started', label: 'Getting Started', icon: UserIcon },
    { path: '/parental-rights', label: 'Parental Rights', icon: UserIcon },
    { path: '/parenting-time-communication', label: 'Parenting Time & Communication', icon: CalendarIcon },
    { path: '/informationsharing',label: 'Information Sharing', icon: ShareIcon },    
  { path: '/tax-exemptions',    label: 'Tax Exemptions',      icon: ReceiptIcon }, 
    { path: '/review', label: 'Review', icon: CheckCircleIcon },
  ];

  const currentStepIndex = navItems.findIndex(item => item.path === location.pathname);
  const isFormStep = currentStepIndex >= 0; // one of the form sections

  return (
    <aside className={`sidebar ${isCollapsed ? 'sidebar--collapsed' : ''}`}>
      <div className="sidebar__header">
        {!isCollapsed && <span className="sidebar__title">Navigate Sections</span>}

        <button
          onClick={onToggle}
          className="sidebar__toggle"
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? (
            <ChevronRightIcon className="sidebar__toggle-icon" />
          ) : (
            <ChevronLeftIcon className="sidebar__toggle-icon" />
          )}
        </button>
      </div>

      <nav className="sidebar__nav" aria-label="Main navigation">
        <ul className="sidebar__nav-list">
          {navItems.map((item, index) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            const isCompleted = isFormStep && currentStepIndex > index;

            return (
              <li key={item.path} className="sidebar__nav-item">
                <Link
                  to={item.path}
                  className={`sidebar__nav-link ${
                    isActive ? 'sidebar__nav-link--active' : ''
                  } ${
                    isCompleted ? 'sidebar__nav-link--completed' : ''
                  }`}
                  title={isCollapsed ? item.label : ''}
                >
                  <div className="sidebar__nav-icon">
                    {isCompleted ? (
                      <CheckCircleIcon className="sidebar__nav-check" />
                    ) : (
                      <Icon className="sidebar__nav-icon-svg" />
                    )}
                  </div>
                  {!isCollapsed && (
                    <span className="sidebar__nav-label">{item.label}</span>
                  )}
                  {!isCollapsed && (
                    <span className="sidebar__nav-step">{index + 1}</span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="sidebar__back">
        <Link
          to="/dashboard"
          className="sidebar__back-link"
          title={isCollapsed ? 'Back to Dashboard' : ''}
        >
          <LayoutDashboard className="sidebar__back-icon" />
          {!isCollapsed && <span>Back to Dashboard</span>}
        </Link>
      </div>

      {isFormStep && !isCollapsed && currentStepIndex >= 0 && (
        <div className="sidebar__progress">
          <div className="sidebar__progress-text">
            Step {currentStepIndex + 1} of {navItems.length}
          </div>
          <div
            className="sidebar__progress-bar"
            role="progressbar"
            aria-label="Form completion progress"
            aria-valuemin={1}
            aria-valuemax={navItems.length}
            aria-valuenow={currentStepIndex + 1}
            aria-valuetext={`Step ${currentStepIndex + 1} of ${navItems.length}`}
          >
            <div
              className="sidebar__progress-fill"
              style={{ width: `${(currentStepIndex / (navItems.length - 1)) * 100}%` }}
            />
          </div>
        </div>
      )}
    </aside>
  );
}