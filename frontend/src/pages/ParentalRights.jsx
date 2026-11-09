import { useEffect, useRef } from 'react';
import { Scale, House, Info } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/common/card';
import { useForm } from '../hooks/useForm';
import { useSectionFlag } from '../hooks/useSectionFlag';
import './Page.css';
import SectionHeader from '../components/forms/SectionHeader';
import RadioQuestion from '../components/forms/RadioQuestion';
import TextQuestion from '../components/forms/TextQuestion';
import { buildApiUrl } from '../lib/apiClient';
import Disclaimer from '../components/forms/Disclaimer';

export default function ParentalRights() {

    const { state, dispatch } = useForm();
    const question = state.question

    useEffect(() => {
        if (state.parental_rights.planID !== state.plan?._id) {
            const planAnswers = (state.plan?.answers ?? []).map((qAnswer) => ({ qKey: qAnswer.qKey, answer: qAnswer.answer }));
            dispatch({
                type: 'UPDATE_SECTION',
                section: 'parental_rights',
                payload: { planID: state.plan._id, responses: planAnswers, errors: {} },
            });
        }
    }, [state.plan?._id]);

    useEffect(() => {
        const needsLoad = !question?.qKey || (question.section !== 'parental-rights' && question.section !== 'health-insurance-coverage');
        if (needsLoad) {
            fetch(buildApiUrl('api/logic-engine/question/allocation_parental_rights'))
                .then(res => {
                    if (!res.ok) throw new Error('Failed to load starting question');
                    return res.json();
                })
                .then(q => {
                    dispatch({ type: 'UPDATE_SECTION', section: 'question', payload: q });
                })
                .catch(err => console.error(err.message));
        }
    }, []);

    useEffect(() => {
        if (!question?.qKey) return;
        const curr = state.parental_rights.responses.find(r => r.qKey === question.qKey);
        const currAnswer = curr?.answer ?? '';
        if (state.currAnswer !== currAnswer) {
            dispatch({ type: 'UPDATE_SECTION', section: 'currAnswer', payload: currAnswer });
        }
    }, [question?.qKey, state.parental_rights.responses, state.currAnswer, dispatch]);

    //flag states for this section
    const childrenApplicationFlag = useSectionFlag(
      question?.qKey ? `question-${question.qKey}` : 'childrenApplication',
    );

    //scroll to first error when validation fails
    const submitAttempted = useRef(false);
    useEffect(() => {
        if (submitAttempted.current) {
            submitAttempted.current = false;
            const firstError = document.querySelector('.text-input__error-message, .date-picker__error-message');
            if (firstError) {
                firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }, [state.parental_rights]);

    // If the question hasn't been loaded into context yet, show nothing rather than crash
    if (!question?.qKey) return null;

    const formData = state.parental_rights
    let curr = formData.responses.find((response) => {return response.qKey === question.qKey})
    if (!curr) {
        curr = {qKey: question.qKey, answer: ''}
        formData.responses.push(curr)
    }
    const currAnswer = curr.answer

    const errors = state.parental_rights?.errors ?? {};

    //generic change handler for form fields in this section
    const handleFormChange = (section, field) => (value) => {
        // update the answer in the responses field
        const updated = formData.responses.map((res) => {return res.qKey === question.qKey ? {qKey: res.qKey, answer: value} : res})
        dispatch({
            type: 'UPDATE_SECTION',
            section: section,
            payload: { [field]: updated }
        });
        if (errors[field]) {
            dispatch({
                type: 'UPDATE_SECTION',
                section: section,
                payload: { errors: { ...errors, [field]: '' } }
            });
        }
        // update question answer field
        dispatch({
            type: 'UPDATE_SECTION',
            section: 'currAnswer',
            payload: value
        });
    };

    return (
        <div className="page-container">
            <div className="page-content">
                <Card>
                    <CardHeader>
                        <CardTitle>Parental Rights</CardTitle>
                        <CardDescription>Define where your children live and who will make legal decisions. </CardDescription>
                    </CardHeader>
                    <Disclaimer variant="warning">
                        This tool is for informational purposes only. It does not provide legal advice about your rights or options available to you. Your responses do not create or establish any legal rights for either parent. This tool is intended to help co-parents think about important topics when making a shared parenting plan. Only a court can approve a parenting plan and make it legally binding. If you have any questions, please talk with a lawyer. 
                    </Disclaimer>
                    <CardContent>
                        <hr className="section-divider" />
                        <section className={question.qKey + "-section"}>
                            <SectionHeader
                                iconClassName={question.qIcon}
                                icon={<Scale size={25} />}
                                title={question.qTitle}
                            />
                        </section>
                        {(() => {
                            if (question.type === "multiple choice") {
                                return (
                                  <>
                                    <RadioQuestion
                                        key={question.qKey}
                                        question={question.qText}
                                        help={question.qIntro}
                                        name={question.qKey}
                                        value={currAnswer}
                                        onChange={handleFormChange("parental_rights", 'responses')}
                                        flag={childrenApplicationFlag}
                                        error={errors.currAnswer}
                                        options={question.options}
                                    />
                                    {question.qDisclaimer && (
                                        <Disclaimer variant="warning">
                                            {question.qDisclaimer}
                                        </Disclaimer>
                                    )}
                                  </>
                                );
                            }
                            if (question.type === "text input") {
                                return (
                                  <>
                                    <TextQuestion
                                        key={question.qKey}
                                        question={question.qText}
                                        id={question.qKey}
                                        value={currAnswer}
                                        onChange={handleFormChange("parental_rights", "responses")}
                                        flag={childrenApplicationFlag}
                                        error={errors.currAnswer}
                                        required
                                    />
                                    {question.qIntro && (
                                        <Disclaimer variant="info">
                                            {question.qIntro}
                                        </Disclaimer>
                                    )}
                                    {question.qDisclaimer && (
                                        <Disclaimer variant="warning">
                                            {question.qDisclaimer}
                                        </Disclaimer>
                                    )}
                                  </>
                                );
                            }
                        })()}
                    </CardContent>    
                </Card>
            </div>
        </div>
    )
}
