import { Calendar, Car, Info } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../lib/firebase';
import { buildApiUrl } from '../lib/apiClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/common/card';
import HolidaySchedule, { getHolidayNames } from '../components/forms/HolidaySchedule';
import PolicyAgreementQuestion from '../components/forms/PolicyAgreementQuestion';
import RadioQuestion from '../components/forms/RadioQuestion';
import ScheduleBuilder from '../components/forms/ScheduleBuilder';
import SchoolSchedule, { SCHOOL_BREAKS, SCHOOL_DAY_OPTIONS } from '../components/forms/SchoolSchedule';
import SectionHeader from '../components/forms/SectionHeader';
import { useNavigation } from '../context/NavigationContext';
import { useForm } from '../hooks/useForm';
import { useSectionFlag } from '../hooks/useSectionFlag';
import Disclaimer from '../components/forms/Disclaimer';
import './Page.css';

const childScheduleKey = (child, index) => child?._id || child?.id || `child-${index + 1}`;

const childDisplayName = (child, index) => [child?.fName, child?.lName].filter(Boolean).join(' ') || `Child ${index + 1}`;

export default function ParentingTimeAndCommunication() {
    const navigate = useNavigate();
    const { state, dispatch } = useForm();
    const { setOnNext, setOnBack } = useNavigation();

    const transportationAgreementFlag = useSectionFlag('transportationAgreement');
    const activitiesAndSchedulingFlag = useSectionFlag('activitiesAndScheduling');
    const parentingScheduleFlag = useSectionFlag('parentingSchedule');
    const communicationWithCoParentOnPhoneFlag = useSectionFlag('communicationWithCoParentOnPhone');
    const notifyCoParentOfChildRelatedEventsFlag = useSectionFlag('notifyCoParentOfChildRelatedEvents');

    const formData = state.timeAndCommunication ?? {
        agreeToTransportationPolicy: false,
        transportationArrangementDescription: '',
        agreeToActivityPolicy: false,
        activityPolicyDescription: '',
        parentingSchedule: {},
        holidaySchedule: {},
        schoolSchedule: {},
        scheduleScope: 'all',
        parentingSchedulesByChild: {},
        holidaySchedulesByChild: {},
        schoolSchedulesByChild: {},
        holidayGatheringAdults: '',
        holidayGatheringAdultsDetails: '',
        communicationWithCoParentOnPhone: '',
        communicationWithCoParentOnPhoneDescription: '',
        notifyCoParentOfChildRelatedEvents: '',
        notifyCoParentOfChildRelatedEventsDescription: '',
        errors: {}
    };
    const errors = state.timeAndCommunication?.errors ?? {};
    const formDataRef = useRef(formData);
    formDataRef.current = formData;
    const children = Array.isArray(state.plan?.children) ? state.plan.children : [];
    const scheduleScope = formData.scheduleScope || 'all';
    const childOptions = children.map((child, index) => ({
        value: childScheduleKey(child, index),
        label: childDisplayName(child, index),
    }));
    const [selectedChildId, setSelectedChildId] = useState(childOptions[0]?.value || '');

    useEffect(() => {
        if (!selectedChildId && childOptions.length) setSelectedChildId(childOptions[0].value);
        if (selectedChildId && !childOptions.some((child) => child.value === selectedChildId)) {
            setSelectedChildId(childOptions[0]?.value || '');
        }
    }, [selectedChildId, childOptions.length]);

    const activeChildId = selectedChildId || childOptions[0]?.value;
    const activeParentingSchedule = scheduleScope === 'byChild'
        ? formData.parentingSchedulesByChild?.[activeChildId] || {}
        : formData.parentingSchedule;
    const activeHolidaySchedule = scheduleScope === 'byChild'
        ? formData.holidaySchedulesByChild?.[activeChildId] || {}
        : formData.holidaySchedule;
    const activeSchoolSchedule = scheduleScope === 'byChild'
        ? formData.schoolSchedulesByChild?.[activeChildId] || {}
        : formData.schoolSchedule;

    // Separate error state for radio groups (not stored in formData.errors)
    const [communicationError, setCommunicationError] = useState('');
    const [notifyError, setNotifyError] = useState('');

    // ── Clear all errors on mount (e.g. user navigated away and came back) ──
    useEffect(() => {
        dispatch({ type: 'UPDATE_SECTION', section: 'timeAndCommunication', payload: { errors: {} } });
        setCommunicationError('');
        setNotifyError('');
    }, []);

    const [submitAttempted, setSubmitAttempted] = useState(false);

    useEffect(() => {
        if (submitAttempted) {
            const firstError = document.querySelector(
                '.text-input__error-message, .date-picker__error-message, .radio-group-error, .holiday-schedule__error'
            );
            if (firstError) firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setSubmitAttempted(false);
        }
    }, [formData, submitAttempted]);

    const handleChange = (field) => (value) => {
        dispatch({ type: 'UPDATE_SECTION', section: 'timeAndCommunication', payload: { [field]: value } });
        if (errors[field]) {
            dispatch({ type: 'UPDATE_SECTION', section: 'timeAndCommunication', payload: { errors: { ...errors, [field]: '' } } });
        }
        if (field === 'communicationWithCoParentOnPhone') setCommunicationError('');
        if (field === 'notifyCoParentOfChildRelatedEvents') setNotifyError('');
    };

    const handlePolicyChange = (field) => (value) => {
        dispatch({
            type: 'UPDATE_SECTION',
            section: 'timeAndCommunication',
            payload: { [field]: value }
        });
        // Clear the paired description error when user agrees to the standard policy
        if (value === true) {
            const descriptionField = field === 'agreeToTransportationPolicy'
                ? 'transportationArrangementDescription'
                : 'activityPolicyDescription';
            if (errors[descriptionField]) {
                dispatch({ type: 'UPDATE_SECTION', section: 'timeAndCommunication', payload: { errors: { ...errors, [descriptionField]: '' } } });
            }
        }
    };

    const handleScheduleChange = useCallback((schedule) => {
        const currentFormData = formDataRef.current;
        const payload = scheduleScope === 'byChild'
            ? { parentingSchedulesByChild: { ...(currentFormData.parentingSchedulesByChild || {}), [activeChildId]: schedule } }
            : { parentingSchedule: schedule };
        dispatch({
            type: 'UPDATE_SECTION',
            section: 'timeAndCommunication',
            payload
        });
        if (errors.parentingSchedule) {
            dispatch({ type: 'UPDATE_SECTION', section: 'timeAndCommunication', payload: { errors: { ...errors, parentingSchedule: '' } } });
        }
    }, [dispatch, errors.parentingSchedule, scheduleScope, activeChildId]);

    const handleHolidayScheduleChange = useCallback((holidaySchedule) => {
        const payload = scheduleScope === 'byChild'
            ? { holidaySchedulesByChild: { ...(formData.holidaySchedulesByChild || {}), [activeChildId]: holidaySchedule } }
            : { holidaySchedule };
        dispatch({
            type: 'UPDATE_SECTION',
            section: 'timeAndCommunication',
            payload
        });
    }, [dispatch, scheduleScope, activeChildId, formData.holidaySchedulesByChild]);

    const handleSchoolScheduleChange = useCallback((schoolSchedule) => {
        const payload = scheduleScope === 'byChild'
            ? { schoolSchedulesByChild: { ...(formData.schoolSchedulesByChild || {}), [activeChildId]: schoolSchedule } }
            : { schoolSchedule };
        dispatch({
            type: 'UPDATE_SECTION',
            section: 'timeAndCommunication',
            payload
        });
    }, [dispatch, scheduleScope, activeChildId, formData.schoolSchedulesByChild]);

    const handleScheduleScopeChange = (event) => {
        const nextScope = event.target.value;
        if (nextScope === 'byChild') {
            const childIds = childOptions.map((child) => child.value);
            const parentingSchedulesByChild = { ...(formData.parentingSchedulesByChild || {}) };
            const holidaySchedulesByChild = { ...(formData.holidaySchedulesByChild || {}) };
            const schoolSchedulesByChild = { ...(formData.schoolSchedulesByChild || {}) };
            childIds.forEach((childId) => {
                parentingSchedulesByChild[childId] ??= formData.parentingSchedule || {};
                holidaySchedulesByChild[childId] ??= formData.holidaySchedule || {};
                schoolSchedulesByChild[childId] ??= formData.schoolSchedule || {};
            });
            dispatch({ type: 'UPDATE_SECTION', section: 'timeAndCommunication', payload: {
                scheduleScope: nextScope,
                parentingSchedulesByChild,
                holidaySchedulesByChild,
                schoolSchedulesByChild,
            } });
        } else {
            dispatch({ type: 'UPDATE_SECTION', section: 'timeAndCommunication', payload: { scheduleScope: nextScope } });
        }
    };

    const validateForm = () => {
        let isValid = true;
        const formErrors = {};

        // Transportation: must agree OR provide description
        if (!formData.agreeToTransportationPolicy && !formData.transportationArrangementDescription?.trim()) {
            formErrors.transportationArrangementDescription = 'Please agree to the standard policy or describe your preferred arrangement';
            isValid = false;
        }

        // Activities: must agree OR provide description
        if (!formData.agreeToActivityPolicy && !formData.activityPolicyDescription?.trim()) {
            formErrors.activityPolicyDescription = 'Please agree to the standard policy or describe your preferred arrangement';
            isValid = false;
        }

        if (!formData.holidayGatheringAdults) {
            formErrors.holidayGatheringAdults = 'Select yes or no.';
            isValid = false;
        } else if (formData.holidayGatheringAdults === 'yes' && !formData.holidayGatheringAdultsDetails?.trim()) {
            formErrors.holidayGatheringAdultsDetails = 'Please list the name of the adult.';
            isValid = false;
        }

        const holidayErrors = {};
        const holidaySchedulesToValidate = scheduleScope === 'later' ? [] : scheduleScope === 'byChild'
            ? Object.values(formData.holidaySchedulesByChild || {})
            : [formData.holidaySchedule];
        holidaySchedulesToValidate.forEach((holidaySchedule) => {
          getHolidayNames(holidaySchedule).forEach((holiday) => {
            const selection = holidaySchedule?.[holiday] || {
                applies: false,
                doesNotApply: false,
                year: '',
                time: '',
                dropOffTime: '',
            };
            const applies = selection.applies ?? (!selection.doesNotApply && Boolean(selection.year || selection.time || selection.alternativeRequest));
            if (!applies && !selection.doesNotApply) {
                holidayErrors[holiday] = { choice: 'Select applies or does not apply' };
                isValid = false;
            } else if (applies && !selection.year) {
                holidayErrors[holiday] = { year: 'Select odd, even, or every year' };
                isValid = false;
            } else if (
                applies &&
                selection.year === 'every' &&
                !/^(0?[1-9]|1[0-2]):[0-5]\d ?(AM|PM)$/i.test(selection.time?.trim() || '')
            ) {
                holidayErrors[holiday] = { time: 'Enter a time like 6:00 PM' };
                isValid = false;
            } else if (
                applies &&
                selection.year === 'every' &&
                !/^(0?[1-9]|1[0-2]):[0-5]\d ?(AM|PM)$/i.test(selection.dropOffTime?.trim() || '')
            ) {
                holidayErrors[holiday] = { dropOffTime: 'Enter a drop-off time like 6:00 PM' };
                isValid = false;
            }
          });
        });
        if (Object.keys(holidayErrors).length > 0) {
            formErrors.holidaySchedule = holidayErrors;
        }

        const schoolErrors = {};
        const schoolSchedulesToValidate = scheduleScope === 'later' ? [] : scheduleScope === 'byChild'
            ? Object.values(formData.schoolSchedulesByChild || {})
            : [formData.schoolSchedule];
        schoolSchedulesToValidate.forEach((schoolSchedule) => {
          getHolidayNames(schoolSchedule, SCHOOL_BREAKS).forEach((schoolBreak) => {
            const selection = schoolSchedule?.[schoolBreak] || {
                applies: false,
                doesNotApply: false,
                year: '',
                time: '',
                dropOffTime: '',
            };
            const applies = selection.applies ?? (!selection.doesNotApply && Boolean(selection.year || selection.time || selection.alternativeRequest));
            if (!applies && !selection.doesNotApply) {
                schoolErrors[schoolBreak] = { choice: 'Select applies or does not apply' };
                isValid = false;
            } else if (applies && !selection.year) {
                schoolErrors[schoolBreak] = {
                    year: SCHOOL_DAY_OPTIONS[schoolBreak]
                        ? 'Select each day, alternate days, or whichever parent has the child that day'
                        : 'Select odd, even, or every year'
                };
                isValid = false;
            } else if (
                applies &&
                !SCHOOL_DAY_OPTIONS[schoolBreak] &&
                selection.year === 'every' &&
                !/^(0?[1-9]|1[0-2]):[0-5]\d ?(AM|PM)$/i.test(selection.time?.trim() || '')
            ) {
                schoolErrors[schoolBreak] = { time: 'Enter a time like 6:00 PM' };
                isValid = false;
            } else if (
                applies &&
                !SCHOOL_DAY_OPTIONS[schoolBreak] &&
                selection.year === 'every' &&
                !/^(0?[1-9]|1[0-2]):[0-5]\d ?(AM|PM)$/i.test(selection.dropOffTime?.trim() || '')
            ) {
                schoolErrors[schoolBreak] = { dropOffTime: 'Enter an end time like 6:00 PM' };
                isValid = false;
            }
          });
        });
        if (Object.keys(schoolErrors).length > 0) {
            formErrors.schoolSchedule = schoolErrors;
        }

        // Communication with co-parent on phone (radio required)
        if (!formData.communicationWithCoParentOnPhone?.trim()) {
            setCommunicationError('Please select an option to continue');
            isValid = false;
        } else {
            setCommunicationError('');
            if (
                formData.communicationWithCoParentOnPhone === 'sometimes' &&
                !formData.communicationWithCoParentOnPhoneDescription?.trim()
            ) {
                formErrors.communicationWithCoParentOnPhoneDescription = 'Please describe the circumstances';
                isValid = false;
            }
        }

        // Notify co-parent of child-related events (radio required)
        if (!formData.notifyCoParentOfChildRelatedEvents?.trim()) {
            setNotifyError('Please select an option to continue');
            isValid = false;
        } else {
            setNotifyError('');
            if (
                formData.notifyCoParentOfChildRelatedEvents === 'sometimes' &&
                !formData.notifyCoParentOfChildRelatedEventsDescription?.trim()
            ) {
                formErrors.notifyCoParentOfChildRelatedEventsDescription = 'Please describe the circumstances';
                isValid = false;
            }
        }

        dispatch({ type: 'UPDATE_SECTION', section: 'timeAndCommunication', payload: { errors: formErrors } });
        return isValid;
    };

    const saveAnswers = async () => {
        const user = auth.currentUser;
        if (!user || !state.plan?._id) return;

        const idToken = await user.getIdToken();
        const response = await fetch(buildApiUrl(`api/plan/${state.plan._id}/sections`), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${idToken}`,
            },
            body: JSON.stringify({
                section: 'parentingTimeAndCommunication',
                answers: formData,
            }),
        });

        if (!response.ok) throw new Error('Failed to save parenting time answers');
        dispatch({ type: 'UPDATE_SECTION', section: 'plan', payload: await response.json() });
    };

    const handleNext = async () => {
        if (!validateForm()) {
            setSubmitAttempted(true);
            return;
        }

        try {
            await saveAnswers();
            navigate('/informationsharing');
        } catch (error) {
            console.error(error.message);
        }
    };

    const handleBack = () => {
        navigate('/parental-rights');
    };

    useEffect(() => {
        setOnNext(handleNext);
        setOnBack(handleBack);
    }, [state, communicationError, notifyError]);

    return (
        <div className="page-container">
            <div className="page-content">
                <Card>
                    <CardHeader>
                        <CardTitle>Parenting Time &amp; Communication</CardTitle>
                        <CardDescription>
                            Establish how parenting time will be structured and communication will work.
                            Fields marked with <span className="required-asterisk">*</span> are required.
                        </CardDescription>
                    </CardHeader>
                    <Disclaimer variant="warning">
                        Legal Disclaimer: This tool is for informational purposes only. It does not provide legal advice about your rights or options available to you. Your responses do not create or establish any legal rights for either parent. This tool is intended to help co-parents think about important topics when making a shared parenting plan. Only a court can approve a parenting plan and make it legally binding. If you have any questions, please talk with a lawyer.
                    </Disclaimer>
                    <CardContent>
                        <hr className="section-divider" />

                        {/* ── Transportation Agreement ── */}
                        <section className="transportation-agreement-section">
                            <SectionHeader
                                iconClassName="car-icon"
                                icon={<Car size={25} />}
                                title="Transportation Agreement"
                                help="Standard transportation arrangements"
                                flag={transportationAgreementFlag}
                            />
                        </section>
                        <PolicyAgreementQuestion
                            policyTitle="Standard Transportation Policy:"
                            policyItems={[
                                'Absent other agreement of the parties included in the attached parenting time schedule, each parent shall be responsible for providing transportation for the child(ren) at the beginning of the parent\'s parenting time period.',
                                'Each parent shall be responsible for providing transportation for the child(ren) to and from school during that parent\'s parenting time period.',
                            ]}
                            checkboxId="agreeToTransportationPolicy"
                            checkboxLabel="I agree to the standard transportation policy"
                            checked={formData.agreeToTransportationPolicy}
                            onCheckboxChange={handlePolicyChange('agreeToTransportationPolicy')}
                            requiredNote="You must either agree to the standard policy or describe your preferred arrangement"
                            textInput={{
                                id: 'transportationArrangementDescription',
                                label: 'Please describe your preferred transportation arrangement:',
                                value: formData.transportationArrangementDescription,
                                onChange: handleChange('transportationArrangementDescription'),
                                placeholder: 'Describe how you would like transportation to be handled if you do not agree to the standard policy',
                                error: errors.transportationArrangementDescription,
                            }}
                            disclaimer="Legal Disclaimer: This tool does not give instructions or legal advice about your rights or choices. If you have questions, please consult with a lawyer."
                            disclaimerVariant="info"
                        />

                        <hr className="section-divider" />
                        <section className="activities-and-scheduling-section">
                            <SectionHeader
                                iconClassName="car-icon"
                                icon={<Calendar size={25} />}
                                title="Activities & Scheduling"
                                help="Supporting your children's activities"
                                flag={activitiesAndSchedulingFlag}
                            />
                        </section>
                        <PolicyAgreementQuestion
                            policyTitle="Standard Activity Policy:"
                            policyItems={[
                                'The scheduling of events, appointments, and activities shall not be done in a manner to cause undue inconvenience or harassment to the other parent.',
                                'Both parents must understand that the child(ren) need(s) to be able to participate in regular activities without interference and with the support of both parents.',
                                'Absent other agreement by the parents, the child(ren) shall continue to participate in those extracurricular activities, school-related and other activities in which they are currently enrolled, uninterrupted.',
                                'Each parent shall provide the other with notice of all extracurricular activities, school-related or otherwise, in which the child(ren) participates, schedules of all activities (handwritten if no formal schedule is provided by the activity) and the name of the activity leader (including address and telephone number if reasonably available).',
                                'Absent other agreement by the parents, it is the responsibility of the parent in possession of the child(ren) to provide transportation to an activity.',
                            ]}
                            checkboxId="agreeToActivityPolicy"
                            checkboxLabel="I agree to the standard activity policy"
                            checked={formData.agreeToActivityPolicy}
                            onCheckboxChange={handlePolicyChange('agreeToActivityPolicy')}
                            textInput={{
                                id: 'activityPolicyDescription',
                                label: 'Please describe your preferred activity policy:',
                                value: formData.activityPolicyDescription,
                                onChange: handleChange('activityPolicyDescription'),
                                placeholder: 'Describe how you would like activities and scheduling to be handled if you do not agree to the standard policy',
                                error: errors.activityPolicyDescription,
                            }}
                            disclaimer="Legal Disclaimer: This tool does not give instructions or legal advice about your rights or choices. If you have questions, please consult with a lawyer."
                            disclaimerVariant="info"
                        />

                        <hr className="section-divider" />

                        {/* ── Parenting Schedule (optional) ── */}
                        <section className="parenting-schedule-section">
                            <SectionHeader
                                iconClassName="car-icon"
                                icon={<Calendar size={25} />}
                                title="Parenting Schedule"
                                help="Create your monthly parenting schedule"
                                flag={parentingScheduleFlag}
                            />
                        </section>
                        <Card>
                            <CardContent>
                                <div className="schedule-scope-controls">
                                    <label htmlFor="schedule-scope">Who does this schedule apply to?</label>
                                    <select id="schedule-scope" value={scheduleScope} onChange={handleScheduleScopeChange}>
                                        <option value="all">All children</option>
                                        <option value="byChild">Set a different schedule for each child</option>
                                        <option value="later">We will determine the schedule later</option>
                                    </select>
                                    {scheduleScope === 'byChild' && childOptions.length > 0 && (
                                        <>
                                            <label htmlFor="schedule-child">Child schedule:</label>
                                            <select id="schedule-child" value={activeChildId} onChange={(event) => setSelectedChildId(event.target.value)}>
                                                {childOptions.map((child) => <option key={child.value} value={child.value}>{child.label}</option>)}
                                            </select>
                                        </>
                                    )}
                                    <p className="schedule-scope-controls__help">
                                        Choose one shared schedule, create a separate schedule for each child, or record that parenting time will be determined later.
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                        {scheduleScope === 'later' && (
                            <Card>
                                <CardContent>
                                    <p className="schedule-scope-controls__help">
                                        The parenting-time schedule, holiday schedule, and school-break schedule will be determined later and are not being entered in this form.
                                    </p>
                                </CardContent>
                            </Card>
                        )}
                        {scheduleScope !== 'later' && <>
                        <Card>
                            <CardHeader>
                                <CardDescription>
                                    Create a typical monthly schedule. Click on any day to set up time slots with specific time frames and assign the responsible parent.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <ScheduleBuilder
                                    value={activeParentingSchedule}
                                    onChange={handleScheduleChange}
                                    parent1Label="You"
                                    parent2Label="Co-Parent"
                                    helpText="Schedule entries are created by selecting a day from Week 1, Week 2, Week 3, or Week 4; assigning a time to You or your Co-Parent; and selecting whether the entry does not repeat, repeats every week, or repeats every other week. You can select one or more weekdays and set a whole day or start and end times."
                                    error={errors.parentingSchedule}
                                />
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardDescription>
                                    Holiday Schedule
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <HolidaySchedule
                                    value={activeHolidaySchedule}
                                    onChange={handleHolidayScheduleChange}
                                    errors={errors.holidaySchedule}
                                />
                            </CardContent>
                        </Card>

                        <RadioQuestion
                            question="Are there any adults at holiday gatherings you do not want your child to be around?"
                            name="holidayGatheringAdults"
                            value={formData.holidayGatheringAdults}
                            onChange={handleChange('holidayGatheringAdults')}
                            error={errors.holidayGatheringAdults}
                            options={[
                                { value: 'yes', label: 'Yes' },
                                { value: 'no', label: 'No' },
                            ]}
                            conditionalInput={{
                                triggerValue: 'yes',
                                id: 'holidayGatheringAdultsDetails',
                                label: 'Please list the name of the adult',
                                value: formData.holidayGatheringAdultsDetails,
                                onChange: handleChange('holidayGatheringAdultsDetails'),
                                placeholder: 'Enter the adult\'s name',
                                error: errors.holidayGatheringAdultsDetails,
                            }}
                        />

                        <Card>
                            <CardHeader>
                                <CardDescription>
                                    School Schedule
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <SchoolSchedule
                                    value={activeSchoolSchedule}
                                    onChange={handleSchoolScheduleChange}
                                    errors={errors.schoolSchedule}
                                />
                            </CardContent>
                        </Card>
                        </>}

                        <hr className="section-divider" />

                        {/* ── Communication with Co-Parent ── */}
                        <section className="communication-section">
                            <SectionHeader
                                iconClassName="car-icon"
                                icon={<Info size={25} />}
                                title="Communication with Co-Parent"
                                help="Phone and communication access"
                            />
                        </section>
                        <RadioQuestion
                            question="If your child is with you, are they allowed to talk to your co-parent on the phone?"
                            name="communicationWithCoParentOnPhone"
                            value={formData.communicationWithCoParentOnPhone}
                            onChange={handleChange('communicationWithCoParentOnPhone')}
                            flag={communicationWithCoParentOnPhoneFlag}
                            error={communicationError}
                            options={[
                                { value: 'yes',                  label: 'Yes' },
                                { value: 'no',                   label: 'No' },
                                { value: 'sometimes',            label: 'Sometimes (please describe)' },
                                { value: 'needMoreInfo',         label: 'I need more information' },
                                { value: 'defaultToCoParentChoice', label: "Default to my co-parent's choice" },
                            ]}
                            conditionalInput={{
                                triggerValue: 'sometimes',
                                id: 'communicationWithCoParentOnPhoneDescription',
                                label: 'Please describe the circumstances under which your child can talk to your co-parent on the phone:',
                                value: formData.communicationWithCoParentOnPhoneDescription,
                                onChange: handleChange('communicationWithCoParentOnPhoneDescription'),
                                placeholder: 'Describe when your child can talk to your co-parent on the phone',
                                error: errors.communicationWithCoParentOnPhoneDescription,
                            }}
                            disclaimer="Legal Disclaimer: This tool does not give instructions or legal advice about your rights or choices. If you have questions, please consult with a lawyer."
                            disclaimerVariant="info"
                        />
                        <RadioQuestion
                            question="Should your co-parent be told if your children get sick or injured?"
                            name="notifyCoParentOfChildRelatedEvents"
                            value={formData.notifyCoParentOfChildRelatedEvents}
                            onChange={handleChange('notifyCoParentOfChildRelatedEvents')}
                            flag={notifyCoParentOfChildRelatedEventsFlag}
                            error={notifyError}
                            options={[
                                { value: 'yes',                  label: 'Yes' },
                                { value: 'no',                   label: 'No' },
                                { value: 'sometimes',            label: 'Sometimes (please describe)' },
                                { value: 'needMoreInfo',         label: 'I need more information' },
                                { value: 'defaultToCoParentChoice', label: "Default to my co-parent's choice" },
                            ]}
                            conditionalInput={{
                                triggerValue: 'sometimes',
                                id: 'notifyCoParentOfChildRelatedEventsDescription',
                                label: 'Please describe the circumstances under which you would notify your co-parent if your child gets sick or injured:',
                                value: formData.notifyCoParentOfChildRelatedEventsDescription,
                                onChange: handleChange('notifyCoParentOfChildRelatedEventsDescription'),
                                placeholder: 'Describe when you would notify your co-parent if your child gets sick or injured',
                                error: errors.notifyCoParentOfChildRelatedEventsDescription,
                            }}
                            disclaimer="Legal Disclaimer: This tool does not give instructions or legal advice about your rights or choices. If you have questions, please consult with a lawyer."
                            disclaimerVariant="info"
                        />
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
