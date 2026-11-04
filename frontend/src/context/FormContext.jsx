import { createContext, useEffect, useReducer } from "react";

export const FormContext = createContext(null);

const initialState = {
  collaborationMode: '', //added this
  caseFilingStatus: '',
  flags: {},
  parents: {
    firstName: '',
    lastName: '',
    secondParentFirstName: '',
    secondParentLastName: '',
    phone: '',
    age: '',
    streetAddress: '',
    addressLine2: '',
    city: '',
    state: '',
    zipCode: '',
    errors: {}
  },
  parentingTime: { errors: {} },
  holidays: { errors: {} },
  decisionMaking: { errors: {} },
  communication: { errors: {} },
  education: { errors: {} },
  transportation: { errors: {} },
  parental_rights: {
    planID: '',
    responses: [],
    errors: {}
  },
  taxExemptions: {
    planID: '',
    responses: [],
    errors: {}
  },
  timeAndCommunication: {
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
    errors: {}
  },
  plan: {},
  question: {},
  currAnswer: ''
};

function formReducer(state, action) {
  switch (action.type) {
    case "UPDATE_SECTION":
      // Handle primitive values (strings, numbers, etc.)
      if (typeof action.payload !== 'object' || action.payload === null) {
        return {
          ...state,
          [action.section]: action.payload
        };
      }
      // Handle object values (merge with existing state)
      return {
        ...state,
        [action.section]: {
          ...state[action.section],
          ...action.payload
        }
      };
    case "UPDATE_FLAG":
      return {
        ...state,
        flags: {
          ...state.flags,
          [action.section]: action.payload
        }
      };
    case "LOAD_SAVED":
      return action.payload;
    case "RESET":
      return initialState;
    default:
      return state;
  }
}

export function FormProvider({ children }) {
  const [state, dispatch] = useReducer(formReducer, initialState, () => {
    const saved = localStorage.getItem("sharedCareForm");
    return saved ? JSON.parse(saved) : initialState;
  });

  useEffect(() => {
    localStorage.setItem("sharedCareForm", JSON.stringify(state));
  }, [state]);

  return (
    <FormContext.Provider value={{ state, dispatch }}>
      {children}
    </FormContext.Provider>
  );
}
