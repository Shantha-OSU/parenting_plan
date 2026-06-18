import { useState, useEffect } from 'react';
import { Info, Shield, Users, UserCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/common/card';
import TextInput from '../components/forms/TextInput';
import DatePicker from '../components/forms/DatePicker';
import { useForm } from '../hooks/useForm';
import { useSectionFlag } from '../hooks/useSectionFlag';
import { useNavigation } from '../context/NavigationContext';
import './Page.css';
import SectionHeader from '../components/forms/SectionHeader';
import RadioQuestion from '../components/forms/RadioQuestion';
import Disclaimer from '../components/forms/Disclaimer';
import SafetyPrivacyQuestion from '../components/forms/SafetyPrivacyQuestion';

export default function GettingStarted() {
  const navigate = useNavigate();
  const { state, dispatch } = useForm();
  const { setOnNext, setOnBack } = useNavigation();

  const formData = state.parents ?? { name: '', secondParentName: '', errors: {} };
  const collaborationMode = (state.plan.collaborationMode || (state.plan.isShared ? 'collaborative' : ''));
  const caseFilingStatus = state.plan.userRole ?? '';
  const residentialParent = state.plan.residentialParent ?? '';
  const parentingGuideInfo = state?.parentingGuideInfo ?? '';
  const errors = formData.errors ?? {};

  const [collaborationModeError, setCollaborationModeError] = useState('');
  const [caseFilingError, setCaseFilingError] = useState('');

  const caseFilingFlag = useSectionFlag('caseFilingStatus');
  const childrenFlag = useSectionFlag('children');

  const [children, setChildren] = useState(() => {
    let startKey = 1
    return state.plan.children?.length > 0
      ? state.plan.children.map(child => {
        const newKid = {...child, isEmancipatedAdult: child.isEmancipatedAdult ? "emancipated" : "minor", key: startKey}
        startKey += 1
        return newKid
      })
      : [{ key: startKey, fName: '', lName: '', birthday: '', isEmancipatedAdult: '', errors: {} }];
  });

  useEffect(() => {
    dispatch({ type: 'UPDATE_SECTION', section: 'parents', payload: { errors: {} } });
    setCollaborationModeError('');
    setCaseFilingError('');
    setChildren(prev => prev.map(c => ({ ...c, errors: {} })));
    if (state.plan.isShared && !state.plan.collaborationMode) {
      handleCollaborationModeChange('collaborative');
    }
  }, []);

  useEffect(() => {
    const fixedChildren = children.map(child => ({...child, isEmancipatedAdult: child.isEmancipatedAdult === "emancipated"})) 
    dispatch({ type: 'UPDATE_SECTION', section: "plan", payload: {children: fixedChildren} });
  }, [children]);

  const handleCollaborationModeChange = (mode) => {
    dispatch({ type: 'UPDATE_SECTION', section: 'collaborationMode', payload: mode });
    dispatch({ type: 'UPDATE_SECTION', section: 'plan', payload: {collaborationMode: mode} });
    if (mode) setCollaborationModeError('');
  };

  const handleRadioChange = (section) => (value) => {
    dispatch({ type: 'UPDATE_SECTION', section: section, payload: value });
  };

  const handleFormChange = (section, field) => (value) => {
    dispatch({ type: 'UPDATE_SECTION', section: section, payload: { [field]: value } });
    if (errors[field]) {
      dispatch({ type: 'UPDATE_SECTION', section: section, payload: { errors: { ...errors, [field]: '' } } });
    }
  };

  const handleChildChange = (childKey, field) => (value) => {
    setChildren(prev => prev.map(child =>
      child.key === childKey
        ? { ...child, [field]: value, errors: { ...(child.errors ?? {}), [field]: '' } }
        : child
    ));
  };

  const addChild = () => {
    const newKey = Math.max(...children.map(c => c.key), 0) + 1;
    setChildren(prev => [...prev, {
      key: newKey,
      fName: '',
      lName: '',
      birthday: '',
      isEmancipatedAdult: '',
      errors: {}
    }]);
  };

  const removeChild = (childKey) => {
    if (children.length > 1) {
      setChildren(prev => prev.filter(child => child.key !== childKey));
    }
  };

  const [submitAttempted, setSubmitAttempted] = useState(false);

  useEffect(() => {
    if (submitAttempted) {
      const firstError = document.querySelector(
        '.text-input__error-message, .date-picker__error-message, .radio-group-error, .child-classification-error'
      );
      if (firstError) firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setSubmitAttempted(false);
    }
  }, [submitAttempted]); 

  return (
    <div className="page-container">
      <div className="page-content">
        <Card>
          <CardHeader>
            <CardTitle>Getting Started</CardTitle>
            <CardDescription>
              Let's start by gathering some basic information about your family and situation.
              Fields marked with <span className="required-asterisk">*</span> are required.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <hr className="section-divider" />

            <section className="safety-privacy-section">
              <SectionHeader
                iconClassName="shield-icon"
                icon={<Shield size={25} />}
                title="Safety & Privacy"
                intro="Your safety is our priority."
              />
              <SafetyPrivacyQuestion
                collaborationMode={collaborationMode}
                onModeChange={handleCollaborationModeChange} 
                error={collaborationModeError} 
              />
            </section>
            <hr className="section-divider" />

            <section className="parent-information-section">
              <SectionHeader
                iconClassName="user-icon"
                icon={<UserCheck size={25} />}
                title="Your Information"
                intro="Please provide your contact details."
              />
              <Card>
                <CardContent>
                  <div className="form-row">
                    <TextInput
                      id="firstParentFirstName" type="text"
                      value={formData.firstName ?? ''}
                      onChange={handleFormChange('parents', 'firstName')}
                      error={errors.firstName}
                      placeholder="Enter your first name"
                      label="First Name" autoComplete="given-name" required
                    />
                    <TextInput
                      id="firstParentLastName" type="text"
                      value={formData.lastName ?? ''}
                      onChange={handleFormChange('parents', 'lastName')}
                      error={errors.lastName}
                      placeholder="Enter your last name"
                      label="Last Name" autoComplete="family-name" required
                    />
                  </div>
                  <TextInput
                    id="firstParentPhone" type="text"
                    value={formData.phone ?? ''}
                    onChange={handleFormChange('parents', 'phone')}
                    error={errors.phone}
                    placeholder="Enter your phone number"
                    label="Phone Number" autoComplete="tel" required
                  />
                  <TextInput
                    className="text-input-long-text"
                    id="firstParentAddress" type="text"
                    value={formData.address ?? ''}
                    onChange={handleFormChange('parents', 'address')}
                    error={errors.address}
                    placeholder="Enter your full address (this will help identify the relevant county)"
                    label="Address" autoComplete="street-address" required
                  />
                </CardContent>
              </Card>
            </section>
            <hr className="section-divider" />

            <section className="case-filing-status-section">
              <SectionHeader
                iconClassName="info-icon"
                icon={<Info size={25} />}
                title="Case Filing Status"
                intro="Help us understand your legal situation."
              />
              <RadioQuestion
                question="Did you file the divorce, separation, or child custody case that led to this parenting plan?"
                name="caseFilingStatus"
                value={caseFilingStatus}
                onChange={handleFormChange('plan', 'userRole')}
                error={caseFilingError}
                flag={caseFilingFlag}
                disclaimers={[
                    { disclaimer: "Please note: ShareCare cannot confirm if your answer is correct or if there is an active divorce, separation, or child support case.", disclaimerVariant: "info" }
                ]}
                options={[
                  { value: 'parent1/petitioner1/plaintiff',     label: 'Yes, it was me',         description: 'You will be identified as Parent 1/Petitioner 1/Plaintiff in the parenting plan' },
                  { value: 'parent2/petitioner2/defendant',     label: 'No, my co-parent filed', description: 'You will be identified as Parent 2/Petitioner 2/Defendant in the parenting plan' },
                  { value: 'flagged',                           label: 'I need more information' },
                  { value: 'defer',                             label: 'Defer to co-parent' },
                ]}
              />
            </section>
            <hr className="section-divider" />

            <section className="children-section">
              <SectionHeader
                iconClassName="users-icon"
                icon={<Users size={25} />}
                title="Your Children"
                intro="Please list the children you are including in this shared parenting plan."
              />
                {children.map((child, index) => (
                  <Card key={child.key}>
                    <CardHeader>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <CardTitle>{`Child ${index + 1}`}</CardTitle>
                        {children.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeChild(child.key)}
                            className="remove-child-btn"
                            aria-label={`Remove Child ${index + 1}`}
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </CardHeader>

                    <CardContent>
                      <form noValidate>
                        <div className="form-row">
                          <TextInput
                            id={`child-${child.key}-firstName`}
                            label="First Name"
                            type="text"
                            value={child.fName}
                            onChange={handleChildChange(child.key, 'fName')}
                            required
                            placeholder="First Name"
                            autoComplete="given-name"
                            error={submitAttempted ? child.errors?.fName : ''}
                          />

                          <TextInput
                            id={`child-${child.key}-lastName`}
                            label="Last Name"
                            type="text"
                            value={child.lName}
                            onChange={handleChildChange(child.key, 'lName')}
                            required
                            placeholder="Last Name"
                            autoComplete="family-name"
                            error={submitAttempted ? child.errors?.lName : ''}
                          />
                        </div>

                        <DatePicker
                          id={`child-${child.key}-dateOfBirth`}
                          label="Date of Birth"
                          value={child.birthday}
                          onChange={handleChildChange(child.key, 'birthday')}
                          required
                          max={new Date().toISOString().split('T')[0]}
                          error={submitAttempted ? child.errors?.birthday : ''}
                        />

                        <div className="child-classification">
                          <label className="classification-label">Child Classification</label>
                          <div className="radio-group">
                            <label className="radio-option">
                              <input
                                type="radio"
                                name={`child-${child.key}-classification`}
                                value="minor"
                                checked={child.isEmancipatedAdult === 'minor'}
                                onChange={(e) => handleChildChange(child.key, 'isEmancipatedAdult')(e.target.value)}
                              />
                              <span>
                                The child is a minor and/or mentally or physically disabled
                                incapable of supporting or maintaining themselves
                              </span>
                            </label>

                            <label className="radio-option">
                              <input
                                type="radio"
                                name={`child-${child.key}-classification`}
                                value="emancipated"
                                checked={child.isEmancipatedAdult === 'emancipated'}
                                onChange={(e) => handleChildChange(child.key, 'isEmancipatedAdult')(e.target.value)}
                              />
                              <span>The child is an emancipated adult</span>
                            </label>
                          </div>
                        </div>
                        {child.errors?.classification && (
                          <p className="child-classification-error">
                            {child.errors.classification}
                          </p>
                        )}
                      </form>
                    </CardContent>
                  </Card>
                ))}

              <button
                type="button"
                onClick={addChild}
                className="add-child-btn"
              >
                + Add Another Child
              </button>
            </section>
            <hr className="section-divider" />

            <section className="residential-parent-section">
              <SectionHeader
                iconClassName="users-icon"
                icon={<Users size={25} />}
                title="Residential Parent"
                intro="This means your child spends most of their time with you"
              />
              <RadioQuestion
                question="Are you the residential parent?"
                name="residentialParent"
                value={residentialParent}
                onChange={handleFormChange('plan', 'residentialParent')}
                options={[
                  { value: 'yes',   label: 'Yes, I am the residential parent' },
                  { value: 'no',    label: 'No, I am not' }
                ]}
              />
            </section>
            <hr className="section-divider" />

            <section className="residential-parent-section">
              <SectionHeader
                iconClassName="info-icon"
                icon={<Info size={25} />}
                title="More Information"
                intro="Link to Ohio Supreme Court Parenting Guide: https://www.supremecourt.ohio.gov/docs/Publications/JCS/parentingGuide.pdf"
              />
              <RadioQuestion
                question="If you are unsure about what parts of this parenting plan mean or how to answer questions, you can find more information about parenting plans in Ohio linked above. Please remember that the Ohio Supreme Court’s guide nor this form are not legal advice nor substitutes for talking to an attorney. Please talk to an attorney if you need more information."
                name="parentingGuideInfo"
                value={parentingGuideInfo}
                onChange={handleRadioChange('parentingGuideInfo')}
                options={[
                  { value: 'yes',   label: 'I understand' }
                ]}
              />
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}