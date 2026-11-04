import { screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import Review from '../../src/pages/Review'
import { renderWithRouter } from '../../src/utils/renderWithRouter'

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: vi.fn((_auth, callback) => {
    callback({ getIdToken: vi.fn(() => Promise.resolve('test-token')) })
    return vi.fn()
  }),
}))

vi.mock('../../src/lib/firebase', () => ({ auth: {} }))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('../../src/components/common/InviteModal', () => ({
  default: ({ isOpen, onClose }) => {
    if (!isOpen) return null
    return (
      <div role="dialog" aria-label="Invite Modal">
        <button onClick={onClose}>Close Invite Modal</button>
      </div>
    )
  },
}))

// Render Disclaimer as a simple labelled wrapper so variant is testable
vi.mock('../../src/components/forms/Disclaimer', () => ({
  default: ({ children, variant }) => (
    <div data-testid={`disclaimer-${variant}`}>{children}</div>
  ),
}))

// useForm mock — state is controlled per test
let mockCollaborationMode = ''
let mockIsSharedPlan = false
let mockPlanAnswers = []
let mockQuestions = []
const mockDispatch = vi.fn()

vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({
  ok: true,
  json: async () => mockQuestions,
})))

vi.mock('../../src/hooks/useForm', () => ({
  useForm: () => ({
    state: {
      collaborationMode: mockCollaborationMode,
      plan: {
        _id: 'plan-1',
        answers: mockPlanAnswers,
        children: [],
        collaborationMode: mockCollaborationMode,
        isShared: mockIsSharedPlan,
      },
    },
    dispatch: mockDispatch,
  }),
}))

// ── Helpers ───────────────────────────────────────────────────────────────────

const renderReview = () => renderWithRouter(<Review />)
const setMode = (mode) => { mockCollaborationMode = mode }

// Clicks the confirm button inside the switch prompt modal by class,
// avoiding ambiguity with any invite button visible behind the overlay.
const confirmSwitch = () => fireEvent.click(document.querySelector('.delete-modal__confirm'))

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Review', () => {
  beforeEach(() => {
    mockNavigate.mockReset()
    mockDispatch.mockReset()
    mockCollaborationMode = ''
    mockIsSharedPlan = false
    mockPlanAnswers = []
    mockQuestions = []
    vi.mocked(fetch).mockImplementation((url) => {
      if (String(url).includes('/api/plan/plan-1')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            _id: 'plan-1',
            answers: mockPlanAnswers,
            children: [],
            collaborationMode: mockCollaborationMode,
            isShared: mockIsSharedPlan,
          }),
        })
      }
      if (String(url).includes('/api/logic-engine/questions')) {
        return Promise.resolve({ ok: true, json: async () => mockQuestions })
      }
      if (String(url).includes('/api/form-templates/')) {
        return Promise.resolve({ ok: true, json: async () => null })
      }
      if (String(url).includes('/api/auth/me')) {
        return Promise.resolve({ ok: true, json: async () => ({ role: 'user' }) })
      }
      return Promise.resolve({ ok: true, json: async () => ({}) })
    })
  })

  // ─── Render ──────────────────────────────────────────────────────────────

  it('renders without crashing', () => {
    renderReview()
  })

  it('displays the Review & Submit Your Plan heading', () => {
    renderReview()
    expect(screen.getByText('Review & Submit Your Plan')).toBeInTheDocument()
  })

  it('displays the page description', () => {
    renderReview()
    expect(screen.getByText(/Check your answers before downloading/i)).toBeInTheDocument()
  })

  it('renders the page container', () => {
    renderReview()
    expect(document.querySelector('.page-container')).toBeInTheDocument()
  })

  it('renders the Download PDF button', () => {
    renderReview()
    expect(screen.getByRole('button', { name: /download pdf/i })).toBeInTheDocument()
  })

  // ─── Legal Disclaimer ────────────────────────────────────────────────────

  it('renders the info disclaimer', () => {
    renderReview()
    expect(screen.getByTestId('disclaimer-info')).toBeInTheDocument()
  })

  it('info disclaimer mentions legal advice', () => {
    renderReview()
    expect(screen.getByTestId('disclaimer-info')).toHaveTextContent(/not.*constitute.*legal advice/i)
  })

  // ─── Section Blocks ───────────────────────────────────────────────────────

  it('renders all five known section titles', () => {
    renderReview()
    expect(screen.getByText('Getting Started')).toBeInTheDocument()
    expect(screen.getByText('Parental Rights')).toBeInTheDocument()
    expect(screen.getByText('Parenting Time & Communication')).toBeInTheDocument()
    expect(screen.getByText('Information Sharing')).toBeInTheDocument()
    expect(screen.getByText('Tax Exemptions')).toBeInTheDocument()
  })

  it('renders an Edit button for each section', () => {
    renderReview()
    // Each edit button has aria-label="Edit <Section Name>" — the leading
    // "Edit " with a trailing space distinguishes them from section toggle
    // buttons whose computed accessible names may also contain "edit"
    const editBtns = screen.getAllByRole('button', { name: /^edit /i })
    expect(editBtns.length).toBe(5)
  })

  it('all sections are expanded by default', () => {
    renderReview()
    expect(screen.getAllByRole('button', { name: /getting started|parental rights|parenting time & communication|information sharing|tax exemptions/i })
      .filter((section) => section.getAttribute('aria-expanded') === 'true')).toHaveLength(5)
  })

  it('clicking a section header collapses it', async () => {
    renderReview()
    const sectionHeaders = screen.getAllByRole('button', { name: /getting started/i })
    await userEvent.click(sectionHeaders[0])
    expect(sectionHeaders[0]).toHaveAttribute('aria-expanded', 'false')
  })

  it('clicking a collapsed section header expands it again', async () => {
    renderReview()
    const sectionHeaders = screen.getAllByRole('button', { name: /getting started/i })
    await userEvent.click(sectionHeaders[0]) // collapse
    await userEvent.click(sectionHeaders[0]) // expand
    expect(sectionHeaders[0]).toHaveAttribute('aria-expanded', 'true')
  })

  it('clicking Edit navigates to the correct route', async () => {
    renderReview()
    await userEvent.click(screen.getByRole('button', { name: /edit getting started/i }))
    expect(mockNavigate).toHaveBeenCalledWith('/getting-started')
  })

  it('enables question editing from the Parental Rights section Edit button', async () => {
    mockQuestions = [{
      qKey: 'individual_child_housing',
      section: 'parental-rights',
      qTitle: 'Individual child housing',
      qText: 'Do you want the child to live with you?',
      type: 'multiple choice',
      options: [{ value: 'yes', label: 'Yes' }],
    }]
    mockPlanAnswers = [{ qKey: 'individual_child_housing', answer: 'yes' }]

    renderReview()

    const sectionEditButton = await screen.findByRole('button', { name: /edit parental rights/i })
    expect(screen.queryByRole('button', { name: /edit individual child housing/i })).not.toBeInTheDocument()
    await userEvent.click(sectionEditButton)
    expect(screen.getByText('Click a question below to edit it.')).toBeInTheDocument()
    const questionButton = await screen.findByRole('button', { name: /edit individual child housing/i })
    await userEvent.click(questionButton)
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'UPDATE_SECTION',
      section: 'question',
      payload: expect.objectContaining({ qKey: 'individual_child_housing' }),
    })
    expect(mockNavigate).toHaveBeenCalledWith('/parental-rights')
  })

  it('clicking Edit does not toggle the section', async () => {
    renderReview()
    await userEvent.click(screen.getByRole('button', { name: /edit getting started/i }))
    const sectionHeader = screen.getAllByRole('button', { name: /getting started/i })
      .find((button) => button.hasAttribute('aria-expanded'))
    expect(sectionHeader)
      .toHaveAttribute('aria-expanded', 'true')
  })

  // ─── Incomplete Warning ───────────────────────────────────────────────────

  it('shows the incomplete warning disclaimer when sections have no answers', () => {
    renderReview()
    // mockPlanChildren is empty so no section is complete
    expect(screen.getByTestId('disclaimer-warning')).toBeInTheDocument()
  })

  it('incomplete disclaimer warns about court acceptance', () => {
    renderReview()
    expect(screen.getByTestId('disclaimer-warning')).toHaveTextContent(/may not be accepted by the court/i)
  })

  it('does not show the warning disclaimer when all sections are complete', async () => {
    // Populate answers with one response per known section so all are complete
    mockPlanAnswers = Object.keys({
      'getting-started': true,
      'parental-rights': true,
      'parenting-time-communication': true,
      'information-sharing': true,
      'tax-exemptions': true,
    }).map((section, index) => ({
      qKey: `q${index}`,
      answer: 'yes',
      isFlagged: false,
      isDeferred: false,
    }))
    mockQuestions = mockPlanAnswers.map(({ qKey }, index) => ({
      qKey,
      section: Object.keys({
        'getting-started': true,
        'parental-rights': true,
        'parenting-time-communication': true,
        'information-sharing': true,
        'tax-exemptions': true,
      })[index],
      qTitle: `Question ${index + 1}`,
    }))
    renderReview()
    await waitFor(() => expect(screen.queryByTestId('disclaimer-warning')).not.toBeInTheDocument())
    expect(screen.queryByTestId('disclaimer-warning')).not.toBeInTheDocument()
  })

  // ─── Section Answers ──────────────────────────────────────────────────────

  it('displays answer values when responses are populated', async () => {
    mockPlanAnswers = [{ qKey: 'parentName', answer: 'Jane Doe' }]
    mockQuestions = [{ qKey: 'parentName', section: 'getting-started' }]
    renderReview()
    await waitFor(() => expect(screen.getByText('Jane Doe')).toBeInTheDocument())
    expect(screen.getByText('Jane Doe')).toBeInTheDocument()
  })

  it('displays "Not answered" for empty answer values', async () => {
    mockPlanAnswers = [{ qKey: 'phone', answer: '' }]
    mockQuestions = [{ qKey: 'phone', section: 'getting-started' }]
    renderReview()
    await waitFor(() => expect(screen.getByText('Not answered')).toBeInTheDocument())
    expect(screen.getByText('Not answered')).toBeInTheDocument()
  })

  it('displays the question key alongside the answer', async () => {
    mockPlanAnswers = [{ qKey: 'parentName', answer: 'Jane Doe' }]
    mockQuestions = [{ qKey: 'parentName', section: 'getting-started' }]
    renderReview()
    await waitFor(() => expect(screen.getByText('parentName')).toBeInTheDocument())
    expect(screen.getByText('parentName')).toBeInTheDocument()
  })

  it('skips responses with an unknown question key', () => {
    mockPlanAnswers = [{ qKey: 'unknown-question', answer: 'should not show' }]
    renderReview()
    expect(screen.queryByText('should not show')).not.toBeInTheDocument()
  })

  // ─── Invite Button — mode: '' (not yet set) ───────────────────────────────

  it('shows "Switch & Invite Co-Parent" button when mode is not set', () => {
    setMode('')
    renderReview()
    expect(screen.getByRole('button', { name: /switch & invite co-parent/i })).toBeInTheDocument()
  })

  it('opens switch prompt when invite is clicked with mode not set', async () => {
    setMode('')
    renderReview()
    await userEvent.click(screen.getByRole('button', { name: /switch & invite co-parent/i }))
    expect(screen.getByText('Switch to collaborative mode?')).toBeInTheDocument()
  })

  // ─── Invite Button — mode: 'collaborative' ────────────────────────────────

  it('shows "Invite Co-Parent" button in collaborative mode', () => {
    setMode('collaborative')
    renderReview()
    expect(screen.getByRole('button', { name: /^invite co-parent$/i })).toBeInTheDocument()
  })

  it('opens the invite modal directly in collaborative mode', async () => {
    setMode('collaborative')
    renderReview()
    await userEvent.click(screen.getByRole('button', { name: /^invite co-parent$/i }))
    expect(screen.getByRole('dialog', { name: /invite modal/i })).toBeInTheDocument()
  })

  it('does not show the switch prompt in collaborative mode', async () => {
    setMode('collaborative')
    renderReview()
    await userEvent.click(screen.getByRole('button', { name: /^invite co-parent$/i }))
    expect(screen.queryByText('Switch to collaborative mode?')).not.toBeInTheDocument()
  })

  // ─── Invite Button — mode: 'individual' ──────────────────────────────────

  it('shows "Switch & Invite Co-Parent" button in individual mode', () => {
    setMode('individual')
    renderReview()
    expect(screen.getByRole('button', { name: /switch & invite co-parent/i })).toBeInTheDocument()
  })

  it('opens switch prompt when invite is clicked in individual mode', async () => {
    setMode('individual')
    renderReview()
    await userEvent.click(screen.getByRole('button', { name: /switch & invite co-parent/i }))
    expect(screen.getByText('Switch to collaborative mode?')).toBeInTheDocument()
  })

  it('does not open the invite modal directly in individual mode', async () => {
    setMode('individual')
    renderReview()
    await userEvent.click(screen.getByRole('button', { name: /switch & invite co-parent/i }))
    expect(screen.queryByRole('dialog', { name: /invite modal/i })).not.toBeInTheDocument()
  })

  // ─── Invite Button — mode: 'locked-individual' ───────────────────────────

  it('hides the invite button entirely in locked-individual mode', () => {
    setMode('locked-individual')
    renderReview()
    expect(screen.queryByRole('button', { name: /invite/i })).not.toBeInTheDocument()
  })

  it('still shows the Download PDF button in locked-individual mode', () => {
    setMode('locked-individual')
    renderReview()
    expect(screen.getByRole('button', { name: /download pdf/i })).toBeInTheDocument()
  })

  it('hides the invite button after the co-parent joins the plan', () => {
    mockIsSharedPlan = true
    setMode('collaborative')
    renderReview()
    expect(screen.queryByRole('button', { name: /invite/i })).not.toBeInTheDocument()
  })

  // ─── Switch Prompt ────────────────────────────────────────────────────────

  it('switch prompt is not visible on initial render', () => {
    setMode('individual')
    renderReview()
    expect(screen.queryByText('Switch to collaborative mode?')).not.toBeInTheDocument()
  })

  it('switch prompt shows the correct description', async () => {
    setMode('individual')
    renderReview()
    await userEvent.click(screen.getByRole('button', { name: /switch & invite co-parent/i }))
    expect(screen.getByText(/You're currently completing this plan individually/i)).toBeInTheDocument()
  })

  it('closes the switch prompt when "Stay in individual mode" is clicked', async () => {
    setMode('individual')
    renderReview()
    await userEvent.click(screen.getByRole('button', { name: /switch & invite co-parent/i }))
    await userEvent.click(screen.getByRole('button', { name: /stay in individual mode/i }))
    expect(screen.queryByText('Switch to collaborative mode?')).not.toBeInTheDocument()
  })

  it('closes the switch prompt when the overlay is clicked', async () => {
    setMode('individual')
    renderReview()
    await userEvent.click(screen.getByRole('button', { name: /switch & invite co-parent/i }))
    fireEvent.click(document.querySelector('.delete-modal__overlay'))
    expect(screen.queryByText('Switch to collaborative mode?')).not.toBeInTheDocument()
  })

  it('does not dispatch when staying in individual mode', async () => {
    setMode('individual')
    renderReview()
    await userEvent.click(screen.getByRole('button', { name: /switch & invite co-parent/i }))
    await userEvent.click(screen.getByRole('button', { name: /stay in individual mode/i }))
    expect(mockDispatch).not.toHaveBeenCalled()
  })

  it('dispatches collaborationMode update when switch is confirmed', async () => {
    setMode('individual')
    renderReview()
    await userEvent.click(screen.getByRole('button', { name: /switch & invite co-parent/i }))
    confirmSwitch()
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'UPDATE_SECTION',
      section: 'collaborationMode',
      payload: 'collaborative',
    })

  })

  it('opens the invite modal after confirming the switch', async () => {
    setMode('individual')
    renderReview()
    await userEvent.click(screen.getByRole('button', { name: /switch & invite co-parent/i }))
    confirmSwitch()
    expect(screen.getByRole('dialog', { name: /invite modal/i })).toBeInTheDocument()
  })

  it('closes the switch prompt after confirming', async () => {
    setMode('individual')
    renderReview()
    await userEvent.click(screen.getByRole('button', { name: /switch & invite co-parent/i }))
    confirmSwitch()
    expect(screen.queryByText('Switch to collaborative mode?')).not.toBeInTheDocument()
  })

  // ─── Invite Modal ─────────────────────────────────────────────────────────

  it('invite modal is not shown on initial render', () => {
    renderReview()
    expect(screen.queryByRole('dialog', { name: /invite modal/i })).not.toBeInTheDocument()
  })

  it('closes the invite modal when dismissed', async () => {
    setMode('collaborative')
    renderReview()
    await userEvent.click(screen.getByRole('button', { name: /^invite co-parent$/i }))
    await userEvent.click(screen.getByRole('button', { name: /close invite modal/i }))
    expect(screen.queryByRole('dialog', { name: /invite modal/i })).not.toBeInTheDocument()
  })
})