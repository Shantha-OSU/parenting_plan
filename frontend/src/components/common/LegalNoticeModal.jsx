import { useState } from 'react';
import { X, Scale, AlertTriangle, RefreshCw, ArrowRight } from 'lucide-react';
import Checkbox from '../forms/Checkbox';
import useModalAccessibility from '../../hooks/useModalAccessibility';
import './LegalNoticeModal.css';

const ACKNOWLEDGMENTS = [
  {
    id: 'ack-no-legal-advice',
    label: 'I understand this form is not legal advice.',
  },
  {
    id: 'ack-no-lawyer',
    label: 'I understand that I will not be provided a lawyer or individual legal help.',
  },
  {
    id: 'ack-law-may-change',
    label: 'I understand that the laws may have changed.',
  },
];

/**
 * LegalNoticeModal
 * @param {boolean} isOpen       - Whether the modal is visible
 * @param {function} onAccept    - Called when user checks all boxes and clicks confirm
 * @param {function} onClose     - Called when user clicks X (cancels sign-up flow)
 */
export default function LegalNoticeModal({ isOpen, onAccept, onClose }) {
  const [checked, setChecked] = useState({
    'ack-no-legal-advice': false,
    'ack-no-lawyer':       false,
    'ack-law-may-change':  false,
  });
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const allChecked = Object.values(checked).every(Boolean);

  const handleCheck = (id) => (value) => {
    setChecked(prev => ({ ...prev, [id]: value }));
  };

  const handleConfirm = () => {
    if (!allChecked) {
      setSubmitAttempted(true);
      return;
    }
    onAccept();
  };

  const handleClose = () => {
    // Reset state so re-opening starts fresh
    setChecked({
      'ack-no-legal-advice': false,
      'ack-no-lawyer':       false,
      'ack-law-may-change':  false,
    });
    setSubmitAttempted(false);
    onClose();
  };

  const { dialogRef, handleKeyDown } = useModalAccessibility(isOpen, handleClose);

  if (!isOpen) return null;

  return (
    <div className="lnm-overlay">
      <div
        ref={dialogRef}
        className="lnm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="lnm-title"
        tabIndex="-1"
        onKeyDown={handleKeyDown}
      >

        {/* Header */}
        <div className="lnm__header">
          <div className="lnm__header-left">
            <div className="lnm__header-icon">
              <Scale size={20} aria-hidden="true" />
            </div>
            <h2 id="lnm-title" className="lnm__title">Important Notices</h2>
          </div>
          <button
            className="lnm__close"
            onClick={handleClose}
            aria-label="Close — you will not be able to create an account without agreeing"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="lnm__body">

          {/* Notice cards */}
          <div className="lnm__notices">
            <div className="lnm__notice">
              <div className="lnm__notice-icon lnm__notice-icon--blue">
                <Scale size={18} aria-hidden="true" />
              </div>
              <div>
                <p className="lnm__notice-title">Not Legal Advice</p>
                <p className="lnm__notice-text">
                  ShareCare is an automated tool and <strong>does not provide legal advice</strong> and
                  does not take the place of an attorney. We encourage you to consult with a lawyer
                  for any legal questions.
                </p>
              </div>
            </div>

            <div className="lnm__notice">
              <div className="lnm__notice-icon lnm__notice-icon--amber">
                <AlertTriangle size={18} aria-hidden="true" />
              </div>
              <div>
                <p className="lnm__notice-title">No Individual Legal Help</p>
                <p className="lnm__notice-text">
                  ShareCare's interactive tool will help you fill out the Supreme Court of Ohio's
                  parenting plan form, but you will <strong>not receive any individual legal help</strong>.
                  ShareCare will not provide a lawyer to go to court with you.
                </p>
              </div>
            </div>

            <div className="lnm__notice">
              <div className="lnm__notice-icon lnm__notice-icon--gray">
                <RefreshCw size={18} aria-hidden="true" />
              </div>
              <div>
                <p className="lnm__notice-title">Laws May Have Changed</p>
                <p className="lnm__notice-text">
                  Laws can change frequently. The information in this tool was correct at the time
                  of its last update, but <strong>the law may have changed since then</strong>.
                </p>
              </div>
            </div>
          </div>

          {/* Divider */}
          <hr className="lnm__divider" />

          {/* Acknowledgments */}
          <div className="lnm__ack-section">
            <p className="lnm__ack-label">
              You must agree to all statements below to create your account:
            </p>
            <div className="lnm__ack-list">
              {ACKNOWLEDGMENTS.map((ack) => (
                <Checkbox
                  key={ack.id}
                  id={ack.id}
                  label={ack.label}
                  checked={checked[ack.id]}
                  onChange={handleCheck(ack.id)}
                  variant="card"
                />
              ))}
            </div>

            {submitAttempted && !allChecked && (
              <p className="lnm__ack-error" role="alert">
                Please check all boxes above to continue.
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="lnm__footer">
          <button className="lnm__cancel-btn" onClick={handleClose}>
            Cancel
          </button>
          <button
            className="lnm__confirm-btn"
            onClick={handleConfirm}
            aria-disabled={!allChecked}
          >
            I Agree — Create Account
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>

      </div>
    </div>
  );
}