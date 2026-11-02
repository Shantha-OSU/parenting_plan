const informationSharingOptions = [
  { value: 'parent1', label: 'Just me' },
  { value: 'parent2', label: 'Just my co-parent' },
  { value: 'both', label: 'Both me and my co-parent' },
  { value: 'needInfo', label: 'I need more information' },
  { value: 'defer', label: "Default to my co-parent's choice" },
];

const parentingTimeOptions = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: 'sometimes', label: 'Sometimes (please describe)' },
  { value: 'needMoreInfo', label: 'I need more information' },
  { value: 'defaultToCoParentChoice', label: "Default to my co-parent's choice" },
];

const schoolAddressOptions = [
  { value: 'me', label: 'Just my address' },
  { value: 'coParent', label: "Just my co-parent's address" },
  { value: 'defaultToCoParent', label: "Default to my co-parent's address" },
  { value: 'needMoreInfo', label: 'I need more information' },
];

const policyAgreementOptions = [
  { value: true, label: 'I agree to the standard policy' },
  { value: false, label: 'I do not agree with the standard policy' },
];

export const CUSTOM_COMPARISON_QUESTIONS = {
  school_address_parent: {
    qText: 'Which parent will be the school-address parent?',
    options: schoolAddressOptions,
  },
  'parentingTimeAndCommunication.parentingSchedule': {
    qText: 'Regular Parenting Schedule',
  },
  'parentingTimeAndCommunication.holidaySchedule': {
    qText: 'Holiday Schedule',
  },
  'parentingTimeAndCommunication.schoolSchedule': {
    qText: 'School Schedule',
  },
  'parentingTimeAndCommunication.agreeToTransportationPolicy': {
    qText: 'Standard Transportation Policy',
    options: policyAgreementOptions,
  },
  'parentingTimeAndCommunication.transportationArrangementDescription': {
    qText: 'Please describe your preferred transportation arrangement:',
  },
  'parentingTimeAndCommunication.agreeToActivityPolicy': {
    qText: 'Standard Activity Policy',
    options: policyAgreementOptions,
  },
  'parentingTimeAndCommunication.activityPolicyDescription': {
    qText: 'Please describe your preferred activity policy:',
  },
  'parentingTimeAndCommunication.communicationWithCoParentOnPhone': {
    qText: 'If your child is with you, are they allowed to talk to your co-parent on the phone?',
    options: parentingTimeOptions,
  },
  'parentingTimeAndCommunication.communicationWithCoParentOnPhoneDescription': {
    qText: 'Please describe the circumstances under which your child can talk to your co-parent on the phone:',
  },
  'parentingTimeAndCommunication.notifyCoParentOfChildRelatedEvents': {
    qText: 'Should your co-parent be told if your children get sick or injured?',
    options: parentingTimeOptions,
  },
  'parentingTimeAndCommunication.notifyCoParentOfChildRelatedEventsDescription': {
    qText: 'Please describe the circumstances under which you would notify your co-parent if your child gets sick or injured:',
  },
  'informationSharing.medicalRecords': {
    qText: 'Medical information access',
    label: 'Medical information access',
    options: informationSharingOptions,
  },
  'informationSharing.schoolContact': {
    qText: 'School contact rights',
    label: 'School contact rights',
    options: informationSharingOptions,
  },
  'informationSharing.schoolActivities': {
    qText: 'School activity participation',
    label: 'School activity participation',
    options: informationSharingOptions,
  },
  'taxExemptions.parentRole': {
    qText: 'Your parental role',
    options: [
      { value: 'residential', label: 'I am the residential parent' },
      { value: 'nonresidential', label: 'I am the non-residential parent' },
    ],
  },
  'taxExemptions.claimingChildren': {
    qText: 'Which children will you claim as tax exemptions?',
  },
  'taxExemptions.childAnswers': {
    qText: 'Tax exemption arrangements for each child',
    childAnswers: true,
  },
};
