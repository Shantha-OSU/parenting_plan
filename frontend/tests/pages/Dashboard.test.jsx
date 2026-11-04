import { screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import Dashboard from '../../src/pages/Dashboard'
import { renderWithRouter } from '../../src/utils/renderWithRouter'

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: vi.fn((auth, callback) => {
    callback({
      uid: '123',
      email: 'test@example.com',
      getIdToken: vi.fn().mockResolvedValue('fake-token'),
    })
    return vi.fn()
  }),
  signOut: vi.fn(() => Promise.resolve()),
  getAuth: vi.fn(),
}))

vi.mock('../../src/lib/firebase', () => ({
  auth: {},
}))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

vi.mock('../../src/components/common/Header', () => ({
  default: ({ onSignOut }) => (
    <header>
      <button onClick={onSignOut}>Sign Out</button>
    </header>
  ),
}))

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

let mockCollaborationMode = ''
const mockDispatch = vi.fn()

vi.mock('../../src/hooks/useForm', () => ({
  useForm: () => ({
    state: { collaborationMode: mockCollaborationMode },
    dispatch: mockDispatch,
  }),
}))

// ── Plan fixtures ─────────────────────────────────────────────────────────────

const TODAY = new Date().toLocaleDateString('en-US')

const DEFAULT_PLAN = {
  _id: 'plan-1',
  name: 'Untitled Plan',
  lastModified: TODAY,
  isShared: false,
  caseId: null,
  currentQuestion: null,
}

const makePlan = () => ({
  _id: 'plan-' + Math.random(),
  name: 'Untitled Plan',
  lastModified: TODAY,
  isShared: false,
  caseId: null,
  currentQuestion: null,
})

// ── Helpers ───────────────────────────────────────────────────────────────────

const renderDashboard = () => renderWithRouter(<Dashboard />)
const setMode = (mode) => { mockCollaborationMode = mode }

// Opens the switch prompt by clicking the first per-plan invite button
const openSwitchPrompt = async () => {
  await screen.findByText('Untitled Plan')
  const switchBtns = screen.getAllByRole('button', { name: /switch & invite/i })
  await userEvent.click(switchBtns[0])
  await screen.findByText('Switch to collaborative mode?')
}

// Clicks the confirm button inside the switch prompt modal specifically,
// avoiding ambiguity with the banner button that stays visible behind it.
const confirmSwitch = () => {
  fireEvent.click(document.querySelector('.delete-modal__confirm'))
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockNavigate.mockReset()
  mockDispatch.mockReset()
  mockCollaborationMode = ''

  global.fetch = vi.fn((url) => {
    // GET all plans for a user
    if (url.includes('/api/plan/all')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve([{ ...DEFAULT_PLAN, collaborationMode: mockCollaborationMode }]),
      })
    }
    // POST create new plan
    if (url.match(/api\/plan\/$/)) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(makePlan()),
      })
    }
    // POST delete plan
    if (url.includes('delete')) {
      return Promise.resolve({ ok: true })
    }
    // PATCH rename plan
    if (url.includes('/name')) {
      return Promise.resolve({ ok: true })
    }
    // Fallback
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
  })
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Dashboard', () => {

  // ─── Render ──────────────────────────────────────────────────────────────

  it('renders without crashing', () => {
    renderDashboard()
  })

  it('displays the Your Plans section', () => {
    renderDashboard()
    expect(screen.getByText('Your Plans')).toBeInTheDocument()
  })

  it('shows admins a link to the admin view', async () => {
    renderDashboard()
    const adminLink = await screen.findByRole('link', { name: /admin view/i })
    expect(adminLink).toHaveAttribute('href', '/admin')
  })

  it('renders the New Plan button', () => {
    renderDashboard()
    expect(screen.getByRole('button', { name: /new plan/i })).toBeInTheDocument()
  })

  it('renders the default plan card', async () => {
    renderDashboard()
    expect(await screen.findByText('Untitled Plan')).toBeInTheDocument()
  })

  it('renders the Open Plan button on plan cards', async () => {
    renderDashboard()
    expect(await screen.findByRole('button', { name: /open plan/i })).toBeInTheDocument()
  })

  it('renders the Sign Out button via Header', () => {
    renderDashboard()
    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument()
  })

  // ─── Auth ─────────────────────────────────────────────────────────────────

  it('signs out and navigates to "/" when Sign Out is clicked', async () => {
    const { signOut } = await import('firebase/auth')
    renderDashboard()
    await userEvent.click(screen.getByRole('button', { name: /sign out/i }))
    await waitFor(() => {
      expect(signOut).toHaveBeenCalled()
      expect(mockNavigate).toHaveBeenCalledWith('/')
    })
  })

  it('navigates to /signin when no user is authenticated', async () => {
    const { onAuthStateChanged } = await import('firebase/auth')
    vi.mocked(onAuthStateChanged).mockImplementationOnce((auth, callback) => {
      callback(null)
      return vi.fn()
    })
    renderDashboard()
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/signin')
    })
  })

  // ─── Invite Banner — mode: '' (not yet set) ───────────────────────────────

  it('shows the "Switch & Invite" button when mode is not set', async () => {
    setMode('')
    renderDashboard()
    await screen.findByText('Untitled Plan')
    expect(screen.getAllByRole('button', { name: /switch & invite/i }).length).toBeGreaterThanOrEqual(1)
  })

  it('shows the switch prompt when invite is clicked with mode not set', async () => {
    setMode('')
    renderDashboard()
    await openSwitchPrompt()
    expect(screen.getByText('Switch to collaborative mode?')).toBeInTheDocument()
  })

  // ─── Invite Banner — mode: 'collaborative' ────────────────────────────────

  it('shows "Invite Parent" button in collaborative mode', async () => {
    setMode('collaborative')
    renderDashboard()
    await screen.findByText('Untitled Plan')
    expect(screen.getAllByRole('button', { name: /^invite parent$/i }).length).toBeGreaterThanOrEqual(1)
  })

  it('opens the invite modal directly in collaborative mode', async () => {
    setMode('collaborative')
    renderDashboard()
    await screen.findByText('Untitled Plan')
    const inviteBtns = screen.getAllByRole('button', { name: /^invite parent$/i })
    await userEvent.click(inviteBtns[0])
    expect(screen.getByRole('dialog', { name: /invite modal/i })).toBeInTheDocument()
  })

  // ─── Invite Banner — mode: 'individual' ──────────────────────────────────

  it('shows "Switch & Invite" button label in individual mode', async () => {
    setMode('individual')
    renderDashboard()
    await screen.findByText('Untitled Plan')
    expect(screen.getAllByRole('button', { name: /switch & invite/i }).length).toBeGreaterThanOrEqual(1)
  })

  it('shows the switch prompt when invite is clicked in individual mode', async () => {
    setMode('individual')
    renderDashboard()
    await openSwitchPrompt()
    expect(screen.getByText('Switch to collaborative mode?')).toBeInTheDocument()
  })

  it('does not open the invite modal directly in individual mode', async () => {
    setMode('individual')
    renderDashboard()
    await openSwitchPrompt()
    expect(screen.queryByRole('dialog', { name: /invite modal/i })).not.toBeInTheDocument()
  })

  // ─── Invite Banner — mode: 'locked-individual' ───────────────────────────

  it('hides the invite banner entirely in locked-individual mode', () => {
    setMode('locked-individual')
    renderDashboard()
    expect(screen.queryByText('Co-parenting works better together')).not.toBeInTheDocument()
    expect(screen.queryByText("You're working individually")).not.toBeInTheDocument()
  })

  it('hides all invite buttons in locked-individual mode', () => {
    setMode('locked-individual')
    renderDashboard()
    expect(screen.queryByRole('button', { name: /invite/i })).not.toBeInTheDocument()
  })

  it('hides the per-card invite button in locked-individual mode', () => {
    setMode('locked-individual')
    renderDashboard()
    expect(screen.queryByRole('button', { name: /invite parent/i })).not.toBeInTheDocument()
  })

  it('hides the per-card invite button after the co-parent joins the plan', async () => {
    global.fetch = vi.fn((url) => {
      if (url.includes('/all')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([{ ...DEFAULT_PLAN, collaborationMode: mockCollaborationMode, isShared: true }]),
        })
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
    })
    setMode('collaborative')
    renderDashboard()
    await screen.findByText('Untitled Plan')
    expect(screen.queryByRole('button', { name: /invite parent/i })).not.toBeInTheDocument()
  })

  // ─── Switch Prompt ────────────────────────────────────────────────────────

  it('shows the switch prompt description', async () => {
    setMode('individual')
    renderDashboard()
    await openSwitchPrompt()
    expect(screen.getByText(/You're currently completing this plan individually/i)).toBeInTheDocument()
  })

  it('renders the Stay in individual mode button in the switch prompt', async () => {
    setMode('individual')
    renderDashboard()
    await openSwitchPrompt()
    expect(screen.getByRole('button', { name: /stay in individual mode/i })).toBeInTheDocument()
  })

  it('renders the confirm button inside the switch prompt modal', async () => {
    setMode('individual')
    renderDashboard()
    await openSwitchPrompt()
    expect(document.querySelector('.delete-modal__confirm')).toBeInTheDocument()
  })

  it('closes the switch prompt when "Stay in individual mode" is clicked', async () => {
    setMode('individual')
    renderDashboard()
    await openSwitchPrompt()
    await userEvent.click(screen.getByRole('button', { name: /stay in individual mode/i }))
    expect(screen.queryByText('Switch to collaborative mode?')).not.toBeInTheDocument()
  })

  it('closes the switch prompt when the overlay is clicked', async () => {
    setMode('individual')
    renderDashboard()
    await openSwitchPrompt()
    fireEvent.click(document.querySelector('.delete-modal__overlay'))
    expect(screen.queryByText('Switch to collaborative mode?')).not.toBeInTheDocument()
  })

  it('does not dispatch when staying in individual mode', async () => {
    setMode('individual')
    renderDashboard()
    await openSwitchPrompt()
    await userEvent.click(screen.getByRole('button', { name: /stay in individual mode/i }))
    expect(mockDispatch).not.toHaveBeenCalled()
  })

  it('dispatches collaborationMode update when switch is confirmed', async () => {
    setMode('individual')
    renderDashboard()
    await openSwitchPrompt()
    confirmSwitch()
    await waitFor(() => expect(mockDispatch).toHaveBeenCalledWith({
      type: 'UPDATE_SECTION',
      section: 'collaborationMode',
      payload: 'collaborative',
    }))
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/plan/setCollabMode/plan-1'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ mode: 'collaborative' }),
      })
    )
  })

  it('opens the invite modal after confirming the switch', async () => {
    setMode('individual')
    renderDashboard()
    await openSwitchPrompt()
    confirmSwitch()
    expect(await screen.findByRole('dialog', { name: /invite modal/i })).toBeInTheDocument()
  })

  it('closes the switch prompt after confirming', async () => {
    setMode('individual')
    renderDashboard()
    await openSwitchPrompt()
    confirmSwitch()
    await waitFor(() => expect(screen.queryByText('Switch to collaborative mode?')).not.toBeInTheDocument())
  })

  // ─── Plan Management — Add ────────────────────────────────────────────────

  it('adds a new plan when New Plan is clicked', async () => {
    renderDashboard()
    await screen.findByText('Untitled Plan') // wait for initial load
    await userEvent.click(screen.getByRole('button', { name: /new plan/i }))
    await waitFor(() => {
      expect(screen.getAllByText('Untitled Plan').length).toBe(2)
    })
  })

  it('can add multiple plans', async () => {
    renderDashboard()
    await screen.findByText('Untitled Plan') // wait for initial load
    const newPlanBtn = screen.getByRole('button', { name: /new plan/i })
    await userEvent.click(newPlanBtn)
    await userEvent.click(newPlanBtn)
    await waitFor(() => {
      expect(screen.getAllByText('Untitled Plan').length).toBe(3)
    })
  })

  it("new plans show today's date as last modified", async () => {
    renderDashboard()
    await screen.findByText('Untitled Plan') // wait for initial load
    await userEvent.click(screen.getByRole('button', { name: /new plan/i }))
    const today = new Date().toLocaleDateString('en-US')
    await waitFor(() => {
      expect(screen.getAllByText(`Last modified: ${today}`).length).toBeGreaterThanOrEqual(1)
    })
  })

  // ─── Plan Management — Open ───────────────────────────────────────────────

  it('navigates to /getting-started when Open Plan is clicked', async () => {
    renderDashboard()
    await userEvent.click(await screen.findByRole('button', { name: /open plan/i }))
    expect(mockNavigate).toHaveBeenCalledWith('/getting-started')
  })

  // ─── Plan Management — Delete ─────────────────────────────────────────────

  it('shows a delete confirmation modal when the trash icon is clicked', async () => {
    renderDashboard()
    await screen.findByText('Untitled Plan')
    fireEvent.click(document.querySelector('.plan-card__delete-btn'))
    expect(screen.getByText('Delete plan?')).toBeInTheDocument()
  })

  it('shows the plan name in the delete confirmation', async () => {
    renderDashboard()
    await screen.findByText('Untitled Plan')
    fireEvent.click(document.querySelector('.plan-card__delete-btn'))
    expect(screen.getByText(/"Untitled Plan"/)).toBeInTheDocument()
  })

  it('closes the delete modal when Cancel is clicked', async () => {
    renderDashboard()
    await screen.findByText('Untitled Plan')
    fireEvent.click(document.querySelector('.plan-card__delete-btn'))
    await userEvent.click(screen.getByRole('button', { name: /^cancel$/i }))
    expect(screen.queryByText('Delete plan?')).not.toBeInTheDocument()
  })

  it('closes the delete modal when the overlay is clicked', async () => {
    renderDashboard()
    await screen.findByText('Untitled Plan')
    fireEvent.click(document.querySelector('.plan-card__delete-btn'))
    fireEvent.click(document.querySelector('.delete-modal__overlay'))
    expect(screen.queryByText('Delete plan?')).not.toBeInTheDocument()
  })

  it('removes the plan after confirming delete', async () => {
    renderDashboard()
    await screen.findByText('Untitled Plan')
    fireEvent.click(document.querySelector('.plan-card__delete-btn'))
    fireEvent.click(document.querySelector('.delete-modal__confirm'))
    await waitFor(() => {
      expect(screen.queryByText('Untitled Plan')).not.toBeInTheDocument()
    })
  })

  it('closes the delete modal after confirming delete', async () => {
    renderDashboard()
    await screen.findByText('Untitled Plan')
    fireEvent.click(document.querySelector('.plan-card__delete-btn'))
    fireEvent.click(document.querySelector('.delete-modal__confirm'))
    await waitFor(() => {
      expect(screen.queryByText('Delete plan?')).not.toBeInTheDocument()
    })
  })

  // ─── Plan Management — Rename ─────────────────────────────────────────────

  it('shows an edit input when the pencil icon is clicked', async () => {
    renderDashboard()
    await screen.findByText('Untitled Plan')
    fireEvent.click(document.querySelector('.plan-card__edit-btn'))
    expect(document.querySelector('.plan-card__name-input')).toBeInTheDocument()
  })

  it('commits the new name when Enter is pressed', async () => {
    renderDashboard()
    await screen.findByText('Untitled Plan')
    fireEvent.click(document.querySelector('.plan-card__edit-btn'))
    const input = document.querySelector('.plan-card__name-input')
    await userEvent.clear(input)
    await userEvent.type(input, 'My New Plan{Enter}')
    expect(screen.getByText('My New Plan')).toBeInTheDocument()
  })

  it('commits the new name when the input loses focus', async () => {
    renderDashboard()
    await screen.findByText('Untitled Plan')
    fireEvent.click(document.querySelector('.plan-card__edit-btn'))
    const input = document.querySelector('.plan-card__name-input')
    await userEvent.clear(input)
    await userEvent.type(input, 'Focused Plan')
    fireEvent.blur(input)
    expect(screen.getByText('Focused Plan')).toBeInTheDocument()
  })

  it('keeps the original name if the edit input is cleared and blurred', async () => {
    renderDashboard()
    await screen.findByText('Untitled Plan')
    fireEvent.click(document.querySelector('.plan-card__edit-btn'))
    const input = document.querySelector('.plan-card__name-input')
    await userEvent.clear(input)
    fireEvent.blur(input)
    expect(screen.getByText('Untitled Plan')).toBeInTheDocument()
  })

  // ─── Per-card Invite Button ───────────────────────────────────────────────

  it('shows "Invite Parent" on the plan card in collaborative mode', async () => {
    setMode('collaborative')
    renderDashboard()
    expect(await screen.findByRole('button', { name: /invite parent/i })).toBeInTheDocument()
  })

  it('shows "Switch & Invite" on the plan card in individual mode', async () => {
    setMode('individual')
    renderDashboard()
    await screen.findByText('Untitled Plan')
    expect(screen.getAllByRole('button', { name: /switch & invite/i }).length).toBeGreaterThanOrEqual(1)
  })

  it('opens invite modal from per-card button in collaborative mode', async () => {
    setMode('collaborative')
    renderDashboard()
    await userEvent.click(await screen.findByRole('button', { name: /invite parent/i }))
    expect(screen.getByRole('dialog', { name: /invite modal/i })).toBeInTheDocument()
  })

  it('opens switch prompt from per-card button in individual mode', async () => {
    setMode('individual')
    renderDashboard()
    await screen.findByText('Untitled Plan')
    const switchBtns = screen.getAllByRole('button', { name: /switch & invite/i })
    await userEvent.click(switchBtns[switchBtns.length - 1])
    expect(screen.getByText('Switch to collaborative mode?')).toBeInTheDocument()
  })

  // ─── Invite Modal ─────────────────────────────────────────────────────────

  it('invite modal is not shown on initial render', () => {
    renderDashboard()
    expect(screen.queryByRole('dialog', { name: /invite modal/i })).not.toBeInTheDocument()
  })

  it('closes the invite modal when it is dismissed', async () => {
    setMode('collaborative')
    renderDashboard()
    await screen.findByText('Untitled Plan')
    await userEvent.click(screen.getAllByRole('button', { name: /^invite parent$/i })[0])
    await userEvent.click(screen.getByRole('button', { name: /close invite modal/i }))
    expect(screen.queryByRole('dialog', { name: /invite modal/i })).not.toBeInTheDocument()
  })
})