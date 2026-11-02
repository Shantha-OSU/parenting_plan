// Tax-specific disclaimer blocks and the shared intent radio group.

import Disclaimer from '../../components/forms/Disclaimer';

// ─── Shared intent options (6.a and loop-back questions) ─────────────────────

export const INTENT_OPTIONS = [
  { value: 'everyYear', label: 'Yes, I plan to claim my child(ren) for each tax year going forward' },
  { value: 'someYears', label: 'Yes, I plan to split tax years for my child(ren) going forward' },
  { value: 'noClaim',   label: "No, I don't plan to claim my child(ren) for each tax year going forward" },
  { value: 'needInfo',  label: 'I need more information' },
  { value: 'defer',     label: 'Defer to my co-parent' },
];

export function IntentRadioGroup({ name, value, onChange }) {
  return (
    <div className="radio-group">
      {INTENT_OPTIONS.map(opt => (
        <label key={opt.value} className="radio-option">
          <input
            type="radio"
            name={name}
            value={opt.value}
            checked={value === opt.value}
            onChange={() => onChange(opt.value)}
          />
          <span>{opt.label}</span>
        </label>
      ))}
    </div>
  );
}

// ─── 6.b disclaimers — claim every year ──────────────────────────────────────

export function ClaimEveryYearDisclaimers({ parentRole }) {
  return (
    <div className="tax-disclaimers-block">
      <Disclaimer variant="warning">
        To claim your children on tax forms, you must be current on any child support
        that you're required to pay as of December 31 of the tax year in question.
      </Disclaimer>
      {parentRole === 'residential' ? (
        <Disclaimer variant="info">
          As the residential parent, you will receive the necessary tax forms.
        </Disclaimer>
      ) : (
        <Disclaimer variant="info">
          As the non-residential parent, the residential parent is required to deliver
          IRS Form 8332 with any other required paperwork to you by February 15th.
        </Disclaimer>
      )}
    </div>
  );
}

// ─── 6.c disclaimers — split tax years ───────────────────────────────────────

export function ClaimSomeYearsDisclaimers({ taxYears, parentRole }) {
  if (!taxYears || !parentRole) return null;

  if (taxYears === 'odd') {
    return (
      <div className="tax-disclaimers-block">
        {parentRole === 'residential' ? (
          <Disclaimer variant="info">
            You are required to deliver IRS Form 8332 with any other required paperwork
            by February 15th to the non-residential parent for even-numbered tax years.
          </Disclaimer>
        ) : (
          <Disclaimer variant="info">
            Your co-parent is required to deliver IRS Form 8332 with any other required
            paperwork by February 15th to you for odd-numbered tax years.
          </Disclaimer>
        )}
      </div>
    );
  }

  if (taxYears === 'even') {
    return (
      <div className="tax-disclaimers-block">
        {parentRole === 'residential' ? (
          <Disclaimer variant="info">
            You are required to deliver IRS Form 8332 with any other required paperwork
            by February 15th to the non-residential parent for odd-numbered tax years.
          </Disclaimer>
        ) : (
          <Disclaimer variant="info">
            Your co-parent is required to deliver IRS Form 8332 with any other required
            paperwork by February 15th to you for even-numbered tax years.
          </Disclaimer>
        )}
      </div>
    );
  }

  if (taxYears === 'custom') {
    return (
      <div className="tax-disclaimers-block">
        <Disclaimer variant="info">
          The residential parent is required to deliver IRS Form 8332 with any other
          required paperwork by February 15th to the non-residential parent for years
          where the non-residential parent is claiming the child.
        </Disclaimer>
      </div>
    );
  }

  return null;
}

// ─── 6.d disclaimers — defer ──────────────────────────────────────────────────

export function DeferDisclaimers({ parentRole }) {
  return (
    <div className="tax-disclaimers-block">
      {parentRole === 'residential' ? (
        <Disclaimer variant="info">
          As the residential parent, you are required to deliver IRS Form 8332 with any
          other required paperwork by February 15th to the non-residential parent for
          each year they claim the child(ren).
        </Disclaimer>
      ) : (
        <Disclaimer variant="info">
          As the non-residential parent, your co-parent is required to deliver IRS Form
          8332 with any other required paperwork by February 15th to you for each year
          you claim the child(ren).
        </Disclaimer>
      )}
    </div>
  );
}