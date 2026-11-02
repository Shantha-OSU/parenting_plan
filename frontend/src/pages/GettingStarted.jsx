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
import Checkbox from '../components/forms/Checkbox';
import Disclaimer from '../components/forms/Disclaimer';
import SafetyPrivacyQuestion from '../components/forms/SafetyPrivacyQuestion';

function AggregateCheckboxQuestion({ question, name, value, options, onChange }) {
  const selectedValues = Array.isArray(value) ? value : [];

  return (
    <Card>
      <CardHeader>
        <CardDescription className="card-heading-question-bold">
          {question}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="checkbox-group">
          {options.map((option) => (
            <Checkbox
              key={option.value}
              id={`${name}-${option.value}`}
              name={name}
              value={option.value}
              label={option.label}
              checked={selectedValues.includes(option.value)}
              onChange={(checked) => {
                const nextValues = checked
                  ? [...new Set([...selectedValues, option.value])]
                  : selectedValues.filter((selectedValue) => selectedValue !== option.value);
                onChange(nextValues);
              }}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function GettingStarted() {
  const navigate = useNavigate();
  const { state, dispatch } = useForm();
  const { setOnNext, setOnBack } = useNavigation();

  const formData = state.parents ?? { name: '', secondParentName: '', errors: {} };
  const plan = state.plan ?? {};
  const aggregateData = plan.aggregateData ?? {};
  const collaborationMode = plan.collaborationMode ?? '';
  const caseFilingStatus = plan.userRole ?? '';
  const residentialParent = plan.residentialParent ?? '';
  const parentingGuideInfo = state?.parentingGuideInfo ?? '';
  const errors = formData.errors ?? {};

  const [collaborationModeError, setCollaborationModeError] = useState('');
  const [caseFilingError, setCaseFilingError] = useState('');
  const [residentialParentError, setResidentialParentError] = useState('');
  const [parentingGuideError, setParentingGuideError] = useState('');

  const caseFilingFlag = useSectionFlag('caseFilingStatus');
  const childrenFlag = useSectionFlag('children');

  const [children, setChildren] = useState(() => {
    let startKey = 1
    return state.plan.children?.length > 0
      ? state.plan.children.map(child => {
        const newKid = { ...child, age: child.age ?? '', classifications: Array.isArray(child.classifications) ? child.classifications : child.isEmancipatedAdult ? ['emancipated-adult'] : [], key: startKey};
        startKey += 1
        return newKid
      })
      : [{ key: startKey, fName: '', lName: '', age: '', birthday: '', classifications: [], errors: {} }];
  });

  useEffect(() => {
    dispatch({ type: 'UPDATE_SECTION', section: 'parents', payload: { errors: {} } });
    setCollaborationModeError('');
    setCaseFilingError('');
    setResidentialParentError('');
    setParentingGuideError('');
    setChildren(prev => prev.map(c => ({ ...c, errors: {} })));
  }, []);

  useEffect(() => {
    if (!plan._id) return;
    dispatch({
      type: 'UPDATE_SECTION',
      section: 'parents',
      payload: {
        firstName: plan.parentFName ?? '',
        lastName: plan.parentLName ?? '',
        age: plan.parentAge ?? '',
        phone: plan.phoneNumber ?? plan.phone ?? '',
        streetAddress: plan.streetAddress ?? '',
        addressLine2: plan.addressLine2 ?? '',
        city: plan.city ?? '',
        state: plan.state ?? '',
        zipCode: plan.zipCode ?? '',
      },
    });
  }, [plan._id]);

  useEffect(() => {
    const savedChildren = children.map(({ key, errors, ...child }) => ({ ...child, age: child.age === '' ? null : Number(child.age)}));
    dispatch({ type: 'UPDATE_SECTION', section: 'plan', payload: { children: savedChildren }});
  }, [children, dispatch]);

  const handleCollaborationModeChange = (mode) => {
    dispatch({ type: 'UPDATE_SECTION', section: 'collaborationMode', payload: mode });
    dispatch({ type: 'UPDATE_SECTION', section: 'plan', payload: {collaborationMode: mode} });
    if (mode) setCollaborationModeError('');
  };

  const handleRadioChange = (section) => (value) => {
    dispatch({ type: 'UPDATE_SECTION', section: section, payload: value });
    if (section === 'parentingGuideInfo') setParentingGuideError('');
  };

  const handleFormChange = (section, field) => (value) => {
    const payload = { [field]: value };
    if (section === 'plan' && field === 'userRole') {
      payload.isParent2 = value === 'parent2/petitioner2/defendant';
    }
    dispatch({ type: 'UPDATE_SECTION', section: section, payload });
    if (errors[field]) {
      dispatch({ type: 'UPDATE_SECTION', section: section, payload: { errors: { ...errors, [field]: '' } } });
    }
    if (section === 'plan' && field === 'residentialParent') setResidentialParentError('');
  };

  const handleAggregateChange = (field) => (value) => {
    dispatch({
      type: 'UPDATE_SECTION',
      section: 'plan',
      payload: {
        aggregateData: {
          ...aggregateData,
          [field]: value
        }
      }
    });
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
      age: '',
      birthday: '',
      classifications: [],
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

  const validateGettingStarted = () => {
    const requiredParentFields = [
      ['firstName', 'Enter your first name.'],
      ['lastName', 'Enter your last name.'],
      ['age', 'Enter your age.'],
      ['phone', 'Enter your phone number.'],
      ['streetAddress', 'Enter your street address.'],
      ['city', 'Enter your city.'],
      ['state', 'Enter your state.'],
      ['zipCode', 'Enter your ZIP code.'],
    ];
    const parentErrors = {};
    requiredParentFields.forEach(([field, message]) => {
      if (!String(formData[field] ?? '').trim()) parentErrors[field] = message;
    });

    dispatch({
      type: 'UPDATE_SECTION',
      section: 'parents',
      payload: { errors: parentErrors },
    });

    let isValid = Object.keys(parentErrors).length === 0;
    if (!collaborationMode) {
      setCollaborationModeError('Select a collaboration mode to continue.');
      isValid = false;
    } else {
      setCollaborationModeError('');
    }

    if (!caseFilingStatus) {
      setCaseFilingError('Select a case filing status to continue.');
      isValid = false;
    } else {
      setCaseFilingError('');
    }

    const nextChildren = children.map((child) => {
      const childErrors = {};
      if (!String(child.fName ?? '').trim()) childErrors.fName = 'Enter the child\'s first name.';
      if (!String(child.lName ?? '').trim()) childErrors.lName = 'Enter the child\'s last name.';
      if (!String(child.age ?? '').trim()) childErrors.age = 'Enter the child\'s age.';
      if (!child.birthday) childErrors.birthday = 'Enter the child\'s date of birth.';
      if (!child.classifications?.length) childErrors.classification = 'Select at least one child classification.';
      if (Object.keys(childErrors).length > 0) isValid = false;
      return { ...child, errors: childErrors };
    });
    setChildren(nextChildren);

    if (!residentialParent) {
      setResidentialParentError('Select an option to continue.');
      isValid = false;
    } else {
      setResidentialParentError('');
    }

    if (!parentingGuideInfo) {
      setParentingGuideError('Select an option to continue.');
      isValid = false;
    } else {
      setParentingGuideError('');
    }

    setSubmitAttempted(true);
    return isValid;
  };

  useEffect(() => {
    setOnNext(() => validateGettingStarted());
  }, [state, children, setOnNext]);

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
                help="Your safety is our priority."
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
                help="Please provide your contact details."
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
                    id="firstParentAge"
                    type="number"
                    value={formData.age ?? ''}
                    onChange={handleFormChange('parents', 'age')}
                    error={errors.age}
                    placeholder="Enter your age"
                    label="Age"
                    required
                  />
                  <TextInput
                    id="firstParentPhone"
                    type="tel"
                    value={formData.phone ?? ''}
                    onChange={handleFormChange('parents', 'phone')}
                    error={errors.phone}
                    placeholder="Enter your phone number"
                    label="Phone Number"
                    autoComplete="tel"
                    required
                  />
                  <TextInput
                    id="firstParentStreetAddress"
                    type="text"
                    value={formData.streetAddress ?? ''}
                    onChange={handleFormChange('parents', 'streetAddress')}
                    error={errors.streetAddress}
                    placeholder="Street address"
                    label="Street Address"
                    autoComplete="address-line1"
                    required
                  />
                  <TextInput
                    id="firstParentAddressLine2"
                    type="text"
                    value={formData.addressLine2 ?? ''}
                    onChange={handleFormChange('parents', 'addressLine2')}
                    placeholder="Suite, apartment, or PO Box"
                    label="Suite/Apt/PO Box"
                    autoComplete="address-line2"
                  />
                  <TextInput
                    id="firstParentCity"
                    type="text"
                    value={formData.city ?? ''}
                    onChange={handleFormChange('parents', 'city')}
                    error={errors.city}
                    label="City"
                    autoComplete="address-level2"
                    required
                  />
                  <TextInput
                    id="firstParentState"
                    type="text"
                    value={formData.state ?? ''}
                    onChange={handleFormChange('parents', 'state')}
                    error={errors.state}
                    label="State"
                    autoComplete="address-level1"
                    required
                  />
                  <TextInput
                    id="firstParentZipCode"
                    type="text"
                    value={formData.zipCode ?? ''}
                    onChange={handleFormChange('parents', 'zipCode')}
                    error={errors.zipCode}
                    label="Zip Code"
                    autoComplete="postal-code"
                    required
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
                help="Help us understand your legal situation."
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
                  { value: 'no_case',                           label: 'No case has been filed yet by either co-parent' },
                  { value: 'flagged',                             label: 'I\'m not sure' },
                ]}
              />
            </section>
            <hr className="section-divider" />

            <section className="children-section">
              <SectionHeader
                iconClassName="users-icon"
                icon={<Users size={25} />}
                title="Your Children"
                help="Please list the children you are including in this shared parenting plan."
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
                          <TextInput
                            id={`child-${child.key}-age`}
                            label="Age"
                            type="text"
                            value={child.age}
                            onChange={handleChildChange(child.key, 'age')}
                            required
                            placeholder="Age"
                            error={submitAttempted ? child.errors?.age : ''}
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
                          <label className="classification-label"> Child Classification <span>(select all that apply)</span></label>
                            <div className="checkbox-group">
                              <Checkbox
                                id={`child-${child.key}-under-18`}
                                label="My child is under 18."
                                checked={child.classifications.includes('under-18')}
                                onChange={(checked) => {
                                  const classifications = checked ? [...new Set([...child.classifications, 'under-18'])] : child.classifications.filter(value => value !== 'under-18');
                                  handleChildChange(child.key, 'classifications')(classifications);
                                }}
                              />  
                              <Checkbox
                                id={`child-${child.key}-disabled`}
                                label="My child is mentally or physically disabled in such a way that they are not able to support or maintain themselves."
                                checked={child.classifications.includes('disabled')}
                                onChange={(checked) => {
                                  const classifications = checked ? [...new Set([...child.classifications, 'disabled'])] : child.classifications.filter(value => value !== 'disabled');
                                  handleChildChange(child.key, 'classifications')(classifications);
                                }}
                              />
                              <Checkbox
                                id={`child-${child.key}-emancipated-adult`}
                                label="My child is an emancipated adult."
                                checked={child.classifications.includes('emancipated-adult')}
                                onChange={(checked) => {
                                  const classifications = checked ? [...new Set([...child.classifications, 'emancipated-adult'])] : child.classifications.filter(value => value !== 'emancipated-adult');
                                  handleChildChange(child.key, 'classifications')(classifications);
                                }}
                              />
                              {(
                                <Disclaimer variant="info"> An “emancipated adult” is a child who received a court order that legally freed them from parental control and gave them the rights of an adult.
                                </Disclaimer>
                              )}
                            </div>
                            {child.errors?.classification && (
                              <p className="child-classification-error">{child.errors.classification}</p>
                            )}
                          </div>
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
                help="This means your child spends most of their time with you"
              />
              <RadioQuestion
                question="Are you the residential parent?"
                name="residentialParent"
                value={residentialParent}
                onChange={handleFormChange('plan', 'residentialParent')}
                error={residentialParentError}
                options={[
                  { value: 'yes',   label: 'Yes, I am the residential parent' },
                  { value: 'no',    label: 'No, I am not' }
                ]}
              />
            </section>
            <hr className="section-divider" />

            <section className="aggregate-data">
              <SectionHeader
                iconClassName="info-icon"
                icon={<Info size={25} />}
                title="Respondent Profile"
                help="Help us understand your background."
              />
              <Disclaimer variant="info">
                The Demographic Data Policy ensures the integrity of data collection by implementing standard demographic data areas for all Action for Children clients (adults and children). Collecting demographic data serves various purposes, including reporting to funders, program evaluation, and organizational planning. Answering the following questions about demographic data is not required. Any information you provide is completely voluntary.
              </Disclaimer>
              <RadioQuestion
                question="What is your gender?"
                name="gender"
                value={aggregateData.gender ?? ''}
                onChange={handleAggregateChange('gender')}
                options={[
                  { value: 'female/feminine', label: 'Female/Feminine' },
                  { value: 'male/masculine', label: 'Male/Masculine' },
                  { value: 'other', label: 'Other' },
                  { value: 'prefer_not_to_answer', label: 'Prefer not to answer' }
                ]}
              />
              <AggregateCheckboxQuestion
                question="Common descent or cultural background? Select as many options as apply to how you identify."
                name="background"
                value={aggregateData.background}
                onChange={handleAggregateChange('background')}
                options={[
                  { value: 'hispanic/latino', label: 'Hispanic/Latino' },
                  { value: 'mena', label: 'MENA (Middle Eastern/North African)' },
                  { value: 'other', label: 'Not Hispanic/Latino, not MENA' },
                  { value: 'prefer_not_to_answer', label: 'Prefer not to answer/Unknown ethnicity' }
                ]}
              />   
              <AggregateCheckboxQuestion
                question="What is your race? Select as many options as apply to how you identify."
                name="race"
                value={aggregateData.race}
                onChange={handleAggregateChange('race')}
                options={[
                  { value: 'african', label: 'African' },
                  { value: 'black', label: 'Black or African American' },
                  { value: 'american_indian', label: 'American Indian or Alaska Native' },
                  { value: 'asian', label: 'Asian or Asian American' },                  
                  { value: 'middle_eastern', label: 'Middle Eastern or North African' },
                  { value: 'pacific_islander', label: 'Pacific Islander or Native Hawaiian' },
                  { value: 'white', label: 'White or European American' },
                  { value: 'bi-racial', label: 'Bi-racial' },
                  { value: 'multi_racial', label: 'Multiple races/Multi-racial' },
                  { value: 'other', label: 'Race not listed/Other' },
                  { value: 'prefer_not_to_answer', label: 'Prefer not to answer' }
                ]}
              />  
              <RadioQuestion
                question="What is your household income?"
                name="income"
                value={aggregateData.income ?? ''}
                onChange={handleAggregateChange('income')}
                options={[
                  { value: 'under_5k', label: 'Below $4,999' },
                  { value: 'under_10k', label: '$5,000-$9,999' },
                  { value: 'under_20k', label: '$10,000-$19,999' },
                  { value: 'under_40k', label: '$20,000-$39,999' },                  
                  { value: 'under_60k', label: '$40,000-$59,999' },
                  { value: 'under_80k', label: '$60,000-$79,999' },
                  { value: 'under_90k', label: '$80,000-$89,999' },
                  { value: 'under_100k', label: '$90,000-$99,999' },
                  { value: 'over_100k', label: 'Over $100,000' },
                  { value: 'prefer_not_to_answer', label: 'Prefer not to answer' }
                ]}
              />     
              <RadioQuestion
                question="What is your household size?"
                name="household"
                value={aggregateData.household ?? ''}
                onChange={handleAggregateChange('household')}
                options={[
                  { value: '1', label: '1 person' },
                  { value: '2', label: '2 person' },
                  { value: '3', label: '3 person' },
                  { value: '4', label: '4 person' },                  
                  { value: '5', label: '5 person' },
                  { value: '6', label: '6 person' },
                  { value: '7', label: '7 person' },
                  { value: '8', label: '8 person' },
                  { value: '9', label: '9 person' },
                  { value: 'over_10', label: '10+ person' },
                  { value: 'prefer_not_to_answer', label: 'Prefer not to answer' }
                ]}
              />
              <AggregateCheckboxQuestion
                question="What language is spoken at home? Select as many options as apply."
                name="language"
                value={aggregateData.language}
                onChange={handleAggregateChange('language')}
                options={[
                  { value: 'amharic', label: 'Amharic' },
                  { value: 'arabic', label: 'Arabic' },
                  { value: 'asian', label: 'Asian and Pacific Islander languages' },
                  { value: 'english', label: 'English' },                  
                  { value: 'french', label: 'French' },
                  { value: 'haitian', label: 'Haitian Creole' },
                  { value: 'nepali', label: 'Nepali' },
                  { value: 'somali', label: 'Somali' },
                  { value: 'spanish', label: 'Spanish' },
                  { value: 'pashto', label: 'Pashto' },
                  { value: 'other', label: 'Other languages' },
                  { value: 'prefer_not_to_answer', label: 'Prefer not to answer' }
                ]}
              />    
              <RadioQuestion
                question="What is your education"
                name="education"
                value={aggregateData.education ?? ''}
                onChange={handleAggregateChange('education')}
                options={[
                  { value: 'none', label: 'No degree or diploma earned/Less than high school diploma' },
                  { value: 'high_school', label: 'High school or General Education Development (GED)' },
                  { value: 'trade', label: 'Trade/Vocational/Technical Certification/Child Development Associate (CDA)' },
                  { value: 'some_college', label: 'Some college, no degree' },                  
                  { value: 'associate', label: 'Associate\'s degree' },
                  { value: 'bachelor', label: 'Bachelor\'s degree' },
                  { value: 'master', label: 'Master\'s degree' },
                  { value: 'phd', label: 'Doctorate or Professional degree' },
                  { value: 'prefer_not_to_answer', label: 'Prefer not to answer' }
                ]}
              />                                                                                 
            </section>
            <hr className="section-divider" />

            <section className="residential-parent-section">
              <SectionHeader
                iconClassName="info-icon"
                icon={<Info size={25} />}
                title="More Information"
                help={
                  <>
                    Link to the{' '}
                    <a href="https://www.supremecourt.ohio.gov/docs/Publications/JCS/parentingGuide.pdf" target="_blank" rel="noopener noreferrer">Ohio Supreme Court Parenting Guide</a>
                  </>
                }              
              />
              <RadioQuestion
                question="If you are unsure about any part of this parenting plan or how to answer specific questions, review the Ohio parenting plan resources linked above. Please note that neither the Ohio Supreme Court’s guide nor this form serves to give instructions or legal advice about your rights or options available to you. If you have questions, please speak with a lawyer."
                name="parentingGuideInfo"
                value={parentingGuideInfo}
                onChange={handleRadioChange('parentingGuideInfo')}
                error={parentingGuideError}
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