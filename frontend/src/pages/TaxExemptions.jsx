import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Scale, House } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/common/card';
import { useForm } from '../hooks/useForm';
import { useNavigation } from '../context/NavigationContext';
import {
  ClaimEveryYearDisclaimers,
  ClaimSomeYearsDisclaimers,
} from './taxExemptions/TaxExemptionDisclaimers';
import './Page.css';
import './TaxExemptions.css';
import RadioButton from '../components/forms/RadioButton';
import FlagButton from '../components/forms/FlagButton';
import { useSectionFlag } from '../hooks/useSectionFlag';
import SectionHeader from '../components/forms/SectionHeader';
import RadioQuestion from '../components/forms/RadioQuestion';
import { auth } from '../lib/firebase';
import { buildApiUrl } from '../lib/apiClient';
import Disclaimer from '../components/forms/Disclaimer';

// ─── Icons ────────────────────────────────────────────────────────────────────

const FileTextIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
    <path d="M14 2v4a2 2 0 0 0 2 2h4" />
    <path d="M10 9H8" /><path d="M16 13H8" /><path d="M16 17H8" />
  </svg>
);

const InfoIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 16v-4" /><path d="M12 8h.01" />
  </svg>
);

const CheckCircleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <path d="m9 11 3 3L22 4" />
  </svg>
);

// ─── Constants ────────────────────────────────────────────────────────────────

const TAX_YEAR_OPTIONS = [
  { value: 'odd',    label: 'Odd-numbered tax years (e.g. 2025, 2027, 2029…)' },
  { value: 'even',   label: 'Even-numbered tax years (e.g. 2026, 2028, 2030…)' },
  { value: 'custom', label: 'Custom — I will specify the years' },
];

const PARENT_ROLE_OPTIONS = [
  { value: 'residential',    label: 'I am the residential parent' },
  { value: 'nonresidential', label: 'I am the non-residential parent' },
];

// ─── Per-child question block ─────────────────────────────────────────────────
// NOTE: ChildTaxBlock has conditional sub-questions and disclaimer components
// that don't map cleanly to RadioQuestion, so it keeps its hand-rolled structure.

function ChildTaxBlock({
  childName,
  childIndex,
  childData = {},
  parentRole,
  isParent2,
  onUpdate,
  errors = {},
  isFlagged,
  onToggleFlag,
}) {
  const intent      = childData.intent ?? '';
  const taxYears    = childData.taxYears ?? '';
  const taxYearsOpposite = taxYears === 'odd' ? 'even' : 'odd';
  const taxYearParent = childData.taxYearParent ?? '';
  const customYears = childData.customYears ?? '';
  const coParentCustomYears = childData.coParentCustomYears ?? '';

  const isSomeYears = intent === 'parent1SomeYears' || intent === 'parent2SomeYears' || intent === 'someYears';
  const showTaxYearQuestion      = isSomeYears;
  const showCustomYearInput      = showTaxYearQuestion && taxYears === 'custom';
  const showEveryYearDisclaimers = (intent === 'parent1EveryYear' || intent === 'parent2EveryYear' || intent === 'everyYear') && !!parentRole;
  const showSomeYearsDisclaimers = isSomeYears && !!taxYears && !!parentRole;
  const displayParent1 = isParent2 ? 'My co-parent' : 'I';
  const displayParent2 = isParent2 ? 'I' : 'My co-parent';
  const parent1Years = customYears;
  const parent2Years = coParentCustomYears;

  const update = (payload) => onUpdate(childIndex, payload);
  const clearError = (field) => {
    if (errors[field]) update({ errors: { ...errors, [field]: '' } });
  };

  return (
    <div className="child-tax-block">
      <div className="child-tax-block__header">
        <div className="child-tax-block__avatar">
          {childName.charAt(0).toUpperCase()}
        </div>
        <div>
          <p className="child-tax-block__name">{childName}</p>
          <p className="child-tax-block__subtitle">Tax claiming arrangement</p>
        </div>
        {intent && (
          <div className="child-tax-block__status">
            <CheckCircleIcon />
          </div>
        )}
      </div>

      <Card>
        <CardHeader className="card-header-with-flag">
          <CardDescription className="card-heading-question-bold">
            Who will claim {childName} on tax forms?
          </CardDescription>
          <FlagButton isFlagged={isFlagged} onClick={onToggleFlag} />
        </CardHeader>
        <CardContent>
          <div className="radio-group">
            {[
              { value: 'parent1EveryYear', label: `${displayParent1} will claim this child every year` },
              { value: 'parent2EveryYear', label: `${displayParent2} will claim this child every year` },
              { value: 'someYears', label: 'The parents will split claiming this child per year' },
            ].map(({ value, label }) => (
              <RadioButton
                key={value}
                name={`intent-${childIndex}`}
                value={value}
                checked={intent === value}
                onChange={() => {
                  update({
                    intent: value,
                    taxYears: '',
                    customYears: '',
                    coParentCustomYears: '',
                    errors: {},
                  });
                  clearError('intent');
                }}
                label={label}
              />
            ))}
          </div>
          {errors.intent && (
            <p className="text-input__error-message">{errors.intent}</p>
          )}

          {showEveryYearDisclaimers && (
            <ClaimEveryYearDisclaimers parentRole={parentRole} />
          )}

          {showTaxYearQuestion && (
            <div className="child-tax-block__subanswer">
              <p className="parent-label">State split years for {childName}</p>
              <div className="radio-group">
                {TAX_YEAR_OPTIONS.map(({ value, label }) => (
                  <RadioButton
                    key={value}
                    name={`taxYears-${childIndex}`}
                    value={value}
                    checked={taxYears === value}
                    onChange={() => {
                      update({ taxYears: value, taxYearParent: '', customYears: '', coParentCustomYears: '' });
                      clearError('taxYears');
                    }}
                    label={label}
                  />
                ))}
              </div>
              {errors.taxYears && (
                <p className="text-input__error-message">{errors.taxYears}</p>
              )}

              {(taxYears === 'odd' || taxYears === 'even') && (
                <>
                  <p className="parent-label">Which parent will get {childName} for these years?</p>
                  <div className="radio-group">
                    {[
                      { value: 'parent1', label: displayParent1 },
                      { value: 'parent2', label: displayParent2 },
                    ].map(({ value, label }) => (
                      <RadioButton
                        key={value}
                        name={`taxYearParent-${childIndex}`}
                        value={value}
                        checked={taxYearParent === value}
                        onChange={() => {
                          update({ taxYearParent: value });
                          clearError('taxYearParent');
                        }}
                        label={`${label} will get ${childName} for ${taxYears}-numbered years (${label === 'I' ? 'my co-parent' : 'I'} will claim the child in the ${taxYearsOpposite} years)`}
                      />
                    ))}
                  </div>
                  {errors.taxYearParent && (
                    <p className="text-input__error-message">{errors.taxYearParent}</p>
                  )}
                </>
              )}

              {showCustomYearInput && (
                <div className="tax-custom-years">
                  <label className="parent-label" htmlFor={`customYears-${childIndex}`}>
                    Enter the tax years {displayParent1} will claim (comma-separated)
                  </label>
                  <input
                    id={`customYears-${childIndex}`}
                    type="text"
                    className="tax-custom-years__input"
                    placeholder="e.g. 2025, 2027, 2029"
                    value={parent1Years}
                    onChange={(e) => { update({ customYears: e.target.value }); clearError('customYears'); }}
                  />
                  {errors.customYears && (
                    <p className="text-input__error-message">{errors.customYears}</p>
                  )}
                  <label className="parent-label" htmlFor={`coParentCustomYears-${childIndex}`}>
                    Enter the tax years {displayParent2} will claim (comma-separated)
                  </label>
                  <input
                    id={`coParentCustomYears-${childIndex}`}
                    type="text"
                    className="tax-custom-years__input"
                    placeholder="e.g. 2026, 2028, 2030"
                    value={parent2Years}
                    onChange={(e) => { update({ coParentCustomYears: e.target.value }); clearError('coParentCustomYears'); }}
                  />
                  {errors.coParentCustomYears && (
                    <p className="text-input__error-message">{errors.coParentCustomYears}</p>
                  )}
                </div>
              )}

              {showSomeYearsDisclaimers && (
                <ClaimSomeYearsDisclaimers taxYears={taxYears} parentRole={parentRole} />
              )}
            </div>
          )}

        </CardContent>
      </Card>
    </div>
  );
}

// ─── ChildTaxBlock wrapper for use in TaxExemptions ─────────────────────────────
function ChildTaxBlockWrapper({ name, idx, childData, parentRole, isParent2, updateChildAnswer }) {
  const flag = useSectionFlag(`taxChild-${name}`);
  return (
    <ChildTaxBlock
      childName={name}
      childIndex={idx}
      childData={childData}
      parentRole={parentRole}
      isParent2={isParent2}
      onUpdate={(_, payload) => updateChildAnswer(name, payload)}
      errors={childData?.errors ?? {}}
      isFlagged={flag.isFlagged}
      onToggleFlag={flag.toggle}
    />
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const isValidYearList = (value) => {
  const trimmed = value.trim();
  if (!trimmed) return false;
  return trimmed.split(',').map(p => p.trim()).every(p => /^\d{4}$/.test(p));
};

// ─── Main component ───────────────────────────────────────────────────────────

export default function TaxExemptions() {
  const navigate = useNavigate();
  const { state, dispatch } = useForm();
  const { setOnNext, setOnBack } = useNavigation();

  const children         = state.plan?.children ?? [];
  const formData         = state.taxExemptions ?? {};
  const errors           = formData.errors ?? {};
  const parentRole       = formData.parentRole ?? '';
  const isParent2        = state.plan?.userRole
    ? state.plan.userRole === 'parent2/petitioner2/defendant'
    : state.plan?.isParent2 === true;
  const claimingChildren = formData.claimingChildren ?? [];
  const childAnswers     = formData.childAnswers ?? {};


  // ── Flag hooks ────────────────────────────────────────────────────────────
  const parentalRoleFlag     = useSectionFlag('taxParentalRole');

  const allChildNames = children.map((c, i) =>
    `${c.fName ?? c.firstName ?? ''} ${c.lName ?? c.lastName ?? ''}`.trim() || `Child ${i + 1}`
  );

  // ── Sync: remove deleted children from claimingChildren and childAnswers ──
  useEffect(() => {
    if (allChildNames.join('|') !== claimingChildren.join('|')) {
      dispatch({
        type: 'UPDATE_SECTION',
        section: 'taxExemptions',
        payload: { claimingChildren: allChildNames },
      });
    }
    const removedFromClaiming = claimingChildren.filter(name => !allChildNames.includes(name));
    const removedFromAnswers  = Object.keys(childAnswers).filter(name => !allChildNames.includes(name));

    if (removedFromClaiming.length > 0 || removedFromAnswers.length > 0) {
      const nextClaimingChildren = claimingChildren.filter(name => allChildNames.includes(name));
      const nextChildAnswers = { ...childAnswers };
      removedFromAnswers.forEach(name => delete nextChildAnswers[name]);
      dispatch({
        type: 'UPDATE_SECTION',
        section: 'taxExemptions',
        payload: { claimingChildren: nextClaimingChildren, childAnswers: nextChildAnswers },
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allChildNames.join(','), claimingChildren.join(',')]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const update = (payload) =>
    dispatch({ type: 'UPDATE_SECTION', section: 'taxExemptions', payload });

  const clearError = (field) => {
    if (errors[field]) update({ errors: { ...errors, [field]: '' } });
  };

  const updateChildAnswer = (childName, payload) => {
    update({
      childAnswers: {
        ...childAnswers,
        [childName]: { ...(childAnswers[childName] ?? {}), ...payload },
      },
    });
  };

  // ── Validation ────────────────────────────────────────────────────────────
  // Reads directly from state to avoid stale closure in NavigationContext

  const validateForm = useCallback(() => {
    const current         = state.taxExemptions ?? {};
    const currentRole     = current.parentRole ?? '';
    const currentClaiming = allChildNames;
    const currentAnswers  = current.childAnswers ?? {};

    const newErrors = {};
    if (!currentRole)
      newErrors.parentRole = 'Please indicate your parental role.';
    if (currentClaiming.length === 0)
      newErrors.claimingChildren = 'No children were found in this plan.';

    const newChildAnswerErrors = { ...currentAnswers };
    currentClaiming.forEach(name => {
      const ans = currentAnswers[name] ?? {};
      const childErrors = {};
      if (!ans.intent) childErrors.intent = 'Please select an option for this child.';
      const someYears = ['parent1SomeYears', 'parent2SomeYears', 'someYears'].includes(ans.intent);
      if (someYears && !ans.taxYears) childErrors.taxYears = 'Please select which tax years.';
      if (someYears && ['odd', 'even'].includes(ans.taxYears) && !ans.taxYearParent) {
        childErrors.taxYearParent = 'Please select which parent will get the child for those years.';
      }
      if (someYears && ans.taxYears === 'custom') {
        if (!ans.customYears?.trim()) {
          childErrors.customYears = 'Please enter the specific tax years.';
        } else if (!isValidYearList(ans.customYears)) {
          childErrors.customYears = 'Please enter years as comma-separated 4-digit years (e.g. 2025, 2027, 2029).';
        }
        if (!ans.coParentCustomYears?.trim()) {
          childErrors.coParentCustomYears = 'Please enter the specific tax years for your co-parent.';
        } else if (!isValidYearList(ans.coParentCustomYears)) {
          childErrors.coParentCustomYears = 'Please enter your co-parent’s years as comma-separated 4-digit years (e.g. 2026, 2028, 2030).';
        }
      }
      if (Object.keys(childErrors).length > 0)
        newChildAnswerErrors[name] = { ...(currentAnswers[name] ?? {}), errors: childErrors };
    });

    dispatch({
      type: 'UPDATE_SECTION',
      section: 'taxExemptions',
      payload: { errors: newErrors, childAnswers: newChildAnswerErrors },
    });

    return Object.keys(newErrors).length === 0 &&
      currentClaiming.every(name => {
        const ans = currentAnswers[name] ?? {};
        if (!ans.intent) return false;
        const someYears = ['parent1SomeYears', 'parent2SomeYears', 'someYears'].includes(ans.intent);
        if (someYears && !ans.taxYears) return false;
        if (someYears && ['odd', 'even'].includes(ans.taxYears) && !ans.taxYearParent) return false;
        if (someYears && ans.taxYears === 'custom') {
          if (
            !ans.customYears?.trim()
            || !isValidYearList(ans.customYears)
            || !ans.coParentCustomYears?.trim()
            || !isValidYearList(ans.coParentCustomYears)
          ) return false;
        }
        return true;
      });
  }, [state]);

  const [submitAttempted, setSubmitAttempted] = useState(false);

  const handleNext = useCallback(async () => {
    if (!validateForm()) {
      setSubmitAttempted(true);
      return;
    }

    const user = auth.currentUser;
    if (!user || !state.plan?._id) {
      navigate('/review');
      return;
    }

    try {
      const idToken = await user.getIdToken();
      const response = await fetch(buildApiUrl(`api/plan/${state.plan._id}/sections`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ section: 'taxExemptions', answers: state.taxExemptions }),
      });
      if (!response.ok) throw new Error('Failed to save tax exemption answers');
      const savedPlan = await response.json();
      dispatch({ type: 'UPDATE_SECTION', section: 'plan', payload: savedPlan });
      navigate('/review');
    } catch (error) {
      console.error(error.message);
    }
  }, [dispatch, navigate, state, validateForm]);

  const handleBack = useCallback(() => {
    update({ errors: {} });
    navigate('/informationsharing');
  }, []);

  useEffect(() => {
    setOnNext(handleNext);
    setOnBack(handleBack);
  }, [handleNext, handleBack]);

  useEffect(() => {
    if (submitAttempted) {
      const firstError = document.querySelector('.text-input__error-message');
      if (firstError) firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setSubmitAttempted(false);
    }
  }, [formData, submitAttempted]);

  // ── Render ────────────────────────────────────────────────────────────────

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="page-container">
      <div className="page-content">
        <Card>
          <CardHeader>
            <CardTitle>Tax Exemptions</CardTitle>
            <CardDescription>
              Decide which parent will claim each child for tax exemptions.
            </CardDescription>
          </CardHeader>
          <Disclaimer variant="info">
            Each child can only be claimed by one parent on a tax return each year. Assign each child to either parent below.
          </Disclaimer>
          <CardContent>
            <hr className="section-divider" />

            <Card>
              <CardHeader className="card-header-with-flag">
                <CardDescription className="card-heading-question-bold">
                  What is your parental role?
                </CardDescription>
                <FlagButton
                  isFlagged={parentalRoleFlag.isFlagged}
                  onClick={parentalRoleFlag.toggle}
                />
              </CardHeader>
              <CardContent>
                <div className="radio-group">
                  {PARENT_ROLE_OPTIONS.map(({ value, label }) => (
                    <RadioButton
                      key={value}
                      name="parentRole"
                      value={value}
                      checked={parentRole === value}
                      onChange={() => { update({ parentRole: value }); clearError('parentRole'); }}
                      label={label}
                    />
                  ))}
                </div>
                {errors.parentRole && (
                  <p className="text-input__error-message">{errors.parentRole}</p>
                )}
              </CardContent>
            </Card>

            {allChildNames.map((name) => {
              const idx = allChildNames.indexOf(name);
              return (
                <ChildTaxBlockWrapper
                  key={name}
                  name={name}
                  idx={idx}
                  childData={childAnswers[name]}
                  parentRole={parentRole}
                  isParent2={isParent2}
                  updateChildAnswer={updateChildAnswer}
                />
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}