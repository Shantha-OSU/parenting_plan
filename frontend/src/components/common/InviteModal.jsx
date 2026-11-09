import { useState } from 'react';
import { X, UserPlus, Mail, Copy, Check } from 'lucide-react';
import { sendCaseInvite, getPendingInviteLink } from '../../lib/inviteApi';
import useModalAccessibility from '../../hooks/useModalAccessibility';
import './InviteModal.css';

export default function InviteModal({ isOpen, onClose, caseId, onInviteSent }) {
  const [email, setEmail] = useState('');
  const [copied, setCopied] = useState(false);
  const [sent, setSent] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [inviteLink, setInviteLink] = useState(null);
  const { dialogRef, handleKeyDown } = useModalAccessibility(isOpen, onClose);

    if (!isOpen) return null;

  const handleSend = async (e) => {
    e.preventDefault();
    const recipientEmail = email.trim();
    if (!recipientEmail) return;
    setIsSending(true);
    try {
      await sendCaseInvite(caseId, recipientEmail);
      setSent(true);
      setEmail('');
      onInviteSent?.();
      const link = await getPendingInviteLink(caseId);
      if (link) setInviteLink(link);
      setTimeout(() => setSent(false), 3000);
    } catch (error) {
      console.error('Failed to send invite:', error);
    } finally {
      setIsSending(false);
    }
  };

  const handleCopy = () => {
    if (!inviteLink) return;
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Close when clicking the backdrop.
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div
        ref={dialogRef}
        className="invite-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="invite-modal-title"
        tabIndex="-1"
        onKeyDown={handleKeyDown}
      >
        <div className="invite-modal__header">
          <div className="invite-modal__title-row">
            <div className="invite-modal__icon">
              <UserPlus size={22} color="#14abdd" aria-hidden="true" />
            </div>
            <div>
              <h2 id="invite-modal-title" className="invite-modal__title">Invite Other Parent</h2>
              <p className="invite-modal__subtitle">Collaborate on your parenting plan</p>
            </div>
          </div>
          <button className="invite-modal__close" onClick={onClose} aria-label="Close">
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div className="invite-modal__info-box">
          <p>
            <strong>How it works:</strong> Each parent fills out the parenting plan independently. Once both complete it, a comparison summary will be generated showing areas that conflict or where further discussion is necessary. Each parent will have the opportunity to revise their responses after seeing the summary. All changes to original responses will be highlighted to make it easier to track compromises.
          </p>
        </div>
        <div className="invite-modal__info-box">
          <p>
            <strong>Note:</strong> Currently the email system has not been configured, the link needs to be shared directly with the other parent.
          </p>
        </div>

        <div className="invite-modal__section">
          <label className="invite-modal__label" htmlFor="invite-email">
            Send invite via email
          </label>
          <form className="invite-modal__email-row" onSubmit={handleSend}>
            <input
              id="invite-email"
              className="invite-modal__email-input"
              type="email"
              placeholder="other-parent@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button
              type="submit"
              className={`invite-modal__send-btn ${sent ? 'invite-modal__send-btn--sent' : ''}`}
              disabled={sent || isSending}
            >
              <Mail size={16} aria-hidden="true" />
              {isSending ? 'Sending...' : sent ? 'Sent!' : 'Send'}
            </button>
          </form>
        </div>

        <div className="invite-modal__divider">
          <span>or share link</span>
        </div>

        <div className="invite-modal__section">
          <p className="invite-modal__label">Share collaboration link</p>
          <div className="invite-modal__link-row">
            <div className="invite-modal__link-display">
              {inviteLink || (caseId ? 'Send email invite to generate link' : 'Create a plan first')}
            </div>
            <button className="invite-modal__copy-btn" onClick={handleCopy} disabled={!inviteLink}>
              {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>

        <p className="invite-modal__privacy">
          <strong>Privacy Note:</strong> Neither parent will see the other's specific responses.
          Only areas of agreement and disagreement will be highlighted in the comparison summary.
        </p>
      </div>
    </div>
  );
}
