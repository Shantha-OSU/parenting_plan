import { screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import ParentalRights from '../../src/pages/ParentalRights'
import { renderWithRouter } from '../../src/utils/renderWithRouter'

// ─── Mock useNavigate ─────────────────────────────────────────────────────────
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

// ─── Mock scrollIntoView ──────────────────────────────────────────────────────
window.HTMLElement.prototype.scrollIntoView = vi.fn()

// ─── Shared mock state ────────────────────────────────────────────────────────
// Mirrors the real FormContext initialState, with plan.children defined
// and a realistic question object so the component can render.
const PLAN_ID = 'test-plan-id'

const mockQuestion = {
  qKey: 'appliesToAllChildren',
  qTitle: 'Applies to All Children?',
  qIntro: 'Simplify by applying answers to all children.',
  qText: 'Will your answers apply to all of your children?',
  qIcon: '',
  type: 'multiple choice',
  section: 'parental-rights',
  options: [
    { value: 'yes',               label: 'My answers will be the same for all children' },
    { value: 'no',                label: 'I need to answer separately for each child' },
    { value: 'needMoreInfo',      label: 'I need more information' },
    { value: 'defaultToCoParent', label: "Default to my co-parent's choice" },
  ]
}

const baseMockState = {
  safetyConcern: '',
  collaborationMode: '',
  caseFilingStatus: '',
  flags: {},
  parents: {
    firstName: '',
    lastName: '',
    secondParentFirstName: '',
    secondParentLastName: '',
    errors: {}
  },
  children: [],
  parentingTime:    { errors: {} },
  holidays:         { errors: {} },
  decisionMaking:   { errors: {} },
  communication:    { errors: {} },
  education:        { errors: {} },
  transportation:   { errors: {} },
  parental_rights: {
    planID: PLAN_ID,
    responses: [],
    errors: {}
  },
  timeAndCommunication: {
    agreeToTransportationPolicy: false,
    transportationArrangementDescription: '',
    agreeToActivityPolicy: false,
    activityPolicyDescription: '',
    communicationWithCoParentOnPhone: '',
    communicationWithCoParentOnPhoneDescription: '',
    notifyCoParentOfChildRelatedEvents: '',
    errors: {}
  },
  plan: {
    _id: PLAN_ID,
    children: []          // ← this is what line 20 was crashing on
  },
  question: mockQuestion, // ← this is what drives the rendered radio group
  currAnswer: ''
}

// Seed localStorage so FormProvider picks it up on init
function seedState(overrides = {}) {
  const state = { ...baseMockState, ...overrides }
  localStorage.setItem('sharedCareForm', JSON.stringify(state))
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const renderPage = () => renderWithRouter(<ParentalRights />)

// ─── Suite ────────────────────────────────────────────────────────────────────
describe('ParentalRights', () => {
  beforeEach(() => {
    mockNavigate.mockReset()
    localStorage.clear()
    seedState()   // every test starts with a clean, valid state
  })

  // ─── Render ─────────────────────────────────────────────────────────────────

  describe('Render', () => {
    it('renders without crashing', () => {
      renderPage()
    })

    it('displays the Parental Rights heading', () => {
      renderPage()
      expect(screen.getByText('Parental Rights')).toBeInTheDocument()
    })

    it('displays the page description', () => {
      renderPage()
      expect(
        screen.getByText(/Define where your children live and who will make legal decisions/i)
      ).toBeInTheDocument()
    })

    /* Add this feature later 
    it('displays the required fields note', () => {
      renderPage()
      expect(screen.getByText(/Fields marked with/i)).toBeInTheDocument()
    })
      */
  })

  // ─── Section Rendering ───────────────────────────────────────────────────────
  // NOTE: these assertions check content driven by state.question.
  // The component currently renders ONE question at a time (the active question).
  // Update the section titles/intros below to match whatever mockQuestion you set.

  describe('Section Rendering', () => {
    it('displays the section title from the current question', () => {
      renderPage()
      expect(screen.getByText('Applies to All Children?')).toBeInTheDocument()
    })

    it('displays the section intro from the current question', () => {
      renderPage()
      expect(
        screen.getByText('Simplify by applying answers to all children.')
      ).toBeInTheDocument()
    })

    it('displays the question text', () => {
      renderPage()
      expect(
        screen.getByText(/Will your answers apply to all of your children/i)
      ).toBeInTheDocument()
    })
  })

  // ─── Radio Options ───────────────────────────────────────────────────────────
  // These are driven by mockQuestion.options, so they match the active question.

  describe('Radio Options', () => {
    it('renders all radio options from the current question', () => {
      renderPage()
      mockQuestion.options.forEach(({ value }) => {
        expect(
          document.querySelector(`input[name="${mockQuestion.qKey}"][value="${value}"]`)
        ).toBeInTheDocument()
      })
    })

    it('displays the correct label for each option', () => {
      renderPage()
      mockQuestion.options.forEach(({ label }) => {
        expect(screen.getByText(label)).toBeInTheDocument()
      })
    })

    it('no radio is checked by default', () => {
      renderPage()
      mockQuestion.options.forEach(({ value }) => {
        expect(
          document.querySelector(`input[name="${mockQuestion.qKey}"][value="${value}"]`)
        ).not.toBeChecked()
      })
    })

    it('can select an option', async () => {
      renderPage()
      const radio = document.querySelector(
        `input[name="${mockQuestion.qKey}"][value="yes"]`
      )
      await userEvent.click(radio)
      expect(radio).toBeChecked()
    })

    it('selecting a new option deselects the previous one', async () => {
      renderPage()
      const yes = document.querySelector(`input[name="${mockQuestion.qKey}"][value="yes"]`)
      const no  = document.querySelector(`input[name="${mockQuestion.qKey}"][value="no"]`)
      await userEvent.click(yes)
      await userEvent.click(no)
      expect(no).toBeChecked()
      expect(yes).not.toBeChecked()
    })
  })

  // ─── Persistence ─────────────────────────────────────────────────────────────
  // The component reads from context (seeded via localStorage), so a selection
  // made in one mount should survive a remount within the same test.

  describe('Persistence', () => {
    it('persists a selection when the component remounts', async () => {
      const { unmount } = renderPage()
      const radio = document.querySelector(
        `input[name="${mockQuestion.qKey}"][value="yes"]`
      )
      await userEvent.click(radio)
      unmount()

      // Remount — FormProvider re-reads localStorage which was updated by the effect
      renderPage()
      expect(
        document.querySelector(`input[name="${mockQuestion.qKey}"][value="yes"]`)
      ).toBeChecked()
    })

  })

  // ─── Footer Navigation ───────────────────────────────────────────────────────

  describe('Footer Navigation', () => {
    it('renders the Next and Back buttons', () => {
      renderPage()
      expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument()
    })

  })

  // ─── Validation ──────────────────────────────────────────────────────────────
  // The component validates that the current question has an answer before
  // allowing Next. Adjust the error message string to match what your component
  // actually renders (check RadioQuestion / the validateForm function).
  // TODO: use these tests once validation is implemented 

  /*
  describe('Validation', () => {
    it('does not show errors before the form is submitted', () => {
      renderPage()
      expect(screen.queryByText('Please select an option to continue')).not.toBeInTheDocument()
    })

    it('does not navigate when Next is clicked with no answer selected', () => {
      renderPage()
      fireEvent.click(screen.getByRole('button', { name: /next/i }))
      expect(mockNavigate).not.toHaveBeenCalled()
    })

    it('shows an error when Next is clicked with nothing selected', async () => {
      renderPage()
      fireEvent.click(screen.getByRole('button', { name: /next/i }))
      expect(
        await screen.findByText('Please select an option to continue')
      ).toBeInTheDocument()
    })

    it('clears the error after an option is selected', async () => {
      renderPage()
      fireEvent.click(screen.getByRole('button', { name: /next/i }))
      await screen.findByText('Please select an option to continue')

      await userEvent.click(
        document.querySelector(`input[name="${mockQuestion.qKey}"][value="yes"]`)
      )
      expect(
        screen.queryByText('Please select an option to continue')
      ).not.toBeInTheDocument()
    })
  })
  */
})