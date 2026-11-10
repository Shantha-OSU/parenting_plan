import { screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import GettingStarted from '../../src/pages/GettingStarted'
import { renderWithRouter } from '../../src/utils/renderWithRouter'

// Mock useNavigate from react-router-dom
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

// Mock scrollIntoView — not implemented in jsdom
window.HTMLElement.prototype.scrollIntoView = vi.fn()

// ── Helpers ───────────────────────────────────────────────────────────────────

// Selects a raw safety/collaboration radio by value
const selectSafetyOption = async (value) => {
  const radio = document.querySelector(`input[name="safetyConcern"][value="${value}"]`)
  await userEvent.click(radio)
  return radio
}

// Fills in all required fields with valid data and submits.
// Selects 'collaborative' for the safety question (no confirmation sub-flow needed).
const fillValidForm = async () => {
  await selectSafetyOption('collaborative')
  await userEvent.type(document.querySelector('#firstParentFirstName'), 'Jane')
  await userEvent.type(document.querySelector('#firstParentLastName'), 'Doe')
  await userEvent.type(document.querySelector('#firstParentPhone'), '555-555-5555')
  await userEvent.type(document.querySelector('#firstParentAddress'), '123 Main St, Columbus, OH 43215')
  await userEvent.click(document.querySelector('input[name="currentCircumstance"][value="married"]'))
  await userEvent.click(document.querySelector('input[name="caseFilingStatus"][value="parent1/petitioner1/plaintiff"]'))
  await userEvent.click(document.querySelector('input[name="courtCustodyOrderIssued"][value="no"]'))
  await userEvent.type(document.querySelector('#child-1-firstName'), 'Alex')
  await userEvent.type(document.querySelector('#child-1-lastName'), 'Doe')
  fireEvent.change(document.querySelector('#child-1-dateOfBirth'), { target: { value: '2015-06-15' } })
  await userEvent.click(document.querySelector('#child-1-under-18'))
}

describe('GettingStarted', () => {
  beforeEach(() => {
    mockNavigate.mockReset()
    localStorage.clear()
  })

  // ─── Render ───────────────────────────────────────────────────────────────

  it('renders without crashing', () => {
    renderWithRouter(<GettingStarted />)
  })

  it('displays the Getting Started heading', () => {
    renderWithRouter(<GettingStarted />)
    expect(screen.getByText('Getting Started')).toBeInTheDocument()
  })

  it('displays the page description', () => {
    renderWithRouter(<GettingStarted />)
    expect(screen.getByText(/Let's start by gathering some basic information/i)).toBeInTheDocument()
  })

  it('displays the required fields note', () => {
    renderWithRouter(<GettingStarted />)
    expect(screen.getByText(/Fields marked with/i)).toBeInTheDocument()
  })

  // ─── Section Rendering ────────────────────────────────────────────────────

  it('displays the Safety & Privacy section', () => {
    renderWithRouter(<GettingStarted />)
    expect(screen.getByText('Safety & Privacy')).toBeInTheDocument()
    expect(screen.getByText('Your safety is our priority.')).toBeInTheDocument()
  })

  it('displays the Your Information section', () => {
    renderWithRouter(<GettingStarted />)
    expect(screen.getByText('Your Information')).toBeInTheDocument()
    expect(screen.getByText('Please provide your contact details.')).toBeInTheDocument()
  })

  it('displays the Case Filing Status section', () => {
    renderWithRouter(<GettingStarted />)
    expect(screen.getByText('Case Filing Status')).toBeInTheDocument()
    expect(screen.getByText('Help us understand your legal situation.')).toBeInTheDocument()
  })

  it('displays the Your Children section', () => {
    renderWithRouter(<GettingStarted />)
    expect(screen.getByText('Your Children')).toBeInTheDocument()
    expect(screen.getByText(/Please list the children you are including/i)).toBeInTheDocument()
  })

  // ─── Safety & Privacy — Question and Disclaimer ───────────────────────────

  it('displays the safety concern question', () => {
    renderWithRouter(<GettingStarted />)
    expect(
      screen.getByText(/Would sharing information from this questionnaire with your co-parent make you fear for your safety/i)
    ).toBeInTheDocument()
  })

  it('displays the sharing disclaimer', () => {
    renderWithRouter(<GettingStarted />)
    expect(
      screen.getByText(/Your address, contact information, and childcare preferences will be shared/i)
    ).toBeInTheDocument()
  })

  // ─── Safety & Privacy — Three Radio Options ───────────────────────────────

  it('renders all three safety concern radio options', () => {
    renderWithRouter(<GettingStarted />)
    expect(document.querySelector('input[name="safetyConcern"][value="yes"]')).toBeInTheDocument()
    expect(document.querySelector('input[name="safetyConcern"][value="collaborative"]')).toBeInTheDocument()
    expect(document.querySelector('input[name="safetyConcern"][value="no-private"]')).toBeInTheDocument()
  })

  it('displays correct labels for all three safety options', () => {
    renderWithRouter(<GettingStarted />)
    expect(screen.getByText('Yes, please keep my information private')).toBeInTheDocument()
    expect(screen.getByText('No, I wish to collaborate with my co-parent')).toBeInTheDocument()
    expect(screen.getByText("No, but I don't want to share my information with my co-parent for other reasons")).toBeInTheDocument()
  })

  it('no safety option is checked by default', () => {
    renderWithRouter(<GettingStarted />)
    expect(document.querySelector('input[name="safetyConcern"][value="yes"]')).not.toBeChecked()
    expect(document.querySelector('input[name="safetyConcern"][value="collaborative"]')).not.toBeChecked()
    expect(document.querySelector('input[name="safetyConcern"][value="no-private"]')).not.toBeChecked()
  })

  it('can select "Yes" (safety concern)', async () => {
    renderWithRouter(<GettingStarted />)
    const radio = await selectSafetyOption('yes')
    expect(radio).toBeChecked()
  })

  it('can select "collaborative"', async () => {
    renderWithRouter(<GettingStarted />)
    const radio = await selectSafetyOption('collaborative')
    expect(radio).toBeChecked()
  })

  it('can select "no-private" (third option)', async () => {
    renderWithRouter(<GettingStarted />)
    const radio = await selectSafetyOption('no-private')
    expect(radio).toBeChecked()
  })

  it('selecting a new option deselects the previous one', async () => {
    renderWithRouter(<GettingStarted />)
    await selectSafetyOption('yes')
    await selectSafetyOption('collaborative')
    expect(document.querySelector('input[name="safetyConcern"][value="collaborative"]')).toBeChecked()
    expect(document.querySelector('input[name="safetyConcern"][value="yes"]')).not.toBeChecked()
  })

  // ─── Safety & Privacy — Confirmation Sub-flow (third option) ─────────────

  it('shows the confirmation panel when "no-private" is selected', async () => {
    renderWithRouter(<GettingStarted />)
    await selectSafetyOption('no-private')
    expect(screen.getByText(/Are you sure you don't want to collaborate/i)).toBeInTheDocument()
  })

  it('shows both confirmation buttons when "no-private" is selected', async () => {
    renderWithRouter(<GettingStarted />)
    await selectSafetyOption('no-private')
    expect(screen.getByRole('button', { name: /yes, i'm sure/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /no, i will collaborate/i })).toBeInTheDocument()
  })

  it('does not show the confirmation panel by default', () => {
    renderWithRouter(<GettingStarted />)
    expect(screen.queryByText(/Are you sure you don't want to collaborate/i)).not.toBeInTheDocument()
  })

  it('hides the confirmation panel when a different option is selected', async () => {
    renderWithRouter(<GettingStarted />)
    await selectSafetyOption('no-private')
    await selectSafetyOption('yes')
    expect(screen.queryByText(/Are you sure you don't want to collaborate/i)).not.toBeInTheDocument()
  })

  it('"Yes I\'m sure" button commits individual mode and hides the confirmation panel', async () => {
    renderWithRouter(<GettingStarted />)
    await selectSafetyOption('no-private')
    await userEvent.click(screen.getByRole('button', { name: /yes, i'm sure/i }))
    expect(screen.queryByText(/Are you sure you don't want to collaborate/i)).not.toBeInTheDocument()
  })

  it('"No, I will collaborate" switches selection to collaborative and hides the panel', async () => {
    renderWithRouter(<GettingStarted />)
    await selectSafetyOption('no-private')
    await userEvent.click(screen.getByRole('button', { name: /no, i will collaborate/i }))
    expect(screen.queryByText(/Are you sure you don't want to collaborate/i)).not.toBeInTheDocument()
    expect(document.querySelector('input[name="safetyConcern"][value="collaborative"]')).toBeChecked()
    expect(document.querySelector('input[name="safetyConcern"][value="no-private"]')).not.toBeChecked()
  })

  // ─── Your Information ─────────────────────────────────────────────────────

  it('renders the First Name input', () => {
    renderWithRouter(<GettingStarted />)
    expect(document.querySelector('#firstParentFirstName')).toBeInTheDocument()
  })

  it('renders the Last Name input', () => {
    renderWithRouter(<GettingStarted />)
    expect(document.querySelector('#firstParentLastName')).toBeInTheDocument()
  })

  it('renders the Phone Number input', () => {
    renderWithRouter(<GettingStarted />)
    expect(screen.getByLabelText(/Phone Number/i)).toBeInTheDocument()
  })

  it('renders the Address input', () => {
    renderWithRouter(<GettingStarted />)
    expect(screen.getByLabelText(/Address/i)).toBeInTheDocument()
  })

  it('renders parent information placeholder text', () => {
    renderWithRouter(<GettingStarted />)
    expect(screen.getByPlaceholderText(/enter your first name/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/enter your last name/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/enter your phone number/i)).toBeInTheDocument()
  })

  it('can type into the First Name input', async () => {
    renderWithRouter(<GettingStarted />)
    const input = document.querySelector('#firstParentFirstName')
    await userEvent.type(input, 'Jane')
    expect(input).toHaveValue('Jane')
  })

  it('can type into the Last Name input', async () => {
    renderWithRouter(<GettingStarted />)
    const input = document.querySelector('#firstParentLastName')
    await userEvent.type(input, 'Doe')
    expect(input).toHaveValue('Doe')
  })

  it('can type into the Phone Number input', async () => {
    renderWithRouter(<GettingStarted />)
    const input = screen.getByLabelText(/Phone Number/i)
    await userEvent.type(input, '555-555-5555')
    expect(input).toHaveValue('555-555-5555')
  })

  it('can type into the Address input', async () => {
    renderWithRouter(<GettingStarted />)
    const input = screen.getByLabelText(/Address/i)
    await userEvent.type(input, '123 Main St')
    expect(input).toHaveValue('123 Main St')
  })

  // ─── Case Filing Status ───────────────────────────────────────────────────

  it('displays the case filing question', () => {
    renderWithRouter(<GettingStarted />)
    expect(screen.getByText(/Did you file the divorce, separation, custody, paternity, or parenting time petition/i)).toBeInTheDocument()
  })

  it('renders all four case filing status options', () => {
    renderWithRouter(<GettingStarted />)
    expect(document.querySelector('input[name="caseFilingStatus"][value="parent1/petitioner1/plaintiff"]')).toBeInTheDocument()
    expect(document.querySelector('input[name="caseFilingStatus"][value="parent2/petitioner2/defendant"]')).toBeInTheDocument()
    expect(document.querySelector('input[name="caseFilingStatus"][value="no_case"]')).toBeInTheDocument()
    expect(document.querySelector('input[name="caseFilingStatus"][value="flagged"]')).toBeInTheDocument()
  })

  it('displays correct labels for case filing options', () => {
    renderWithRouter(<GettingStarted />)
    expect(screen.getByText('Yes, it was me')).toBeInTheDocument()
    expect(screen.getByText('No, my co-parent filed')).toBeInTheDocument()
    expect(screen.getByText('No case has been filed yet by either co-parent')).toBeInTheDocument()
    expect(screen.getByText("I'm not sure")).toBeInTheDocument()
  })

  it('no case filing status radio is checked by default', () => {
    renderWithRouter(<GettingStarted />)
    ;['parent1/petitioner1/plaintiff', 'parent2/petitioner2/defendant', 'no_case', 'flagged'].forEach(value => {
      expect(document.querySelector(`input[name="caseFilingStatus"][value="${value}"]`)).not.toBeChecked()
    })
  })

  it('can select each case filing status option', async () => {
    renderWithRouter(<GettingStarted />)
    for (const value of ['parent1/petitioner1/plaintiff', 'parent2/petitioner2/defendant', 'no_case', 'flagged']) {
      const radio = document.querySelector(`input[name="caseFilingStatus"][value="${value}"]`)
      await userEvent.click(radio)
      expect(radio).toBeChecked()
    }
  })

  it('selecting a new case filing option deselects the previous one', async () => {
    renderWithRouter(<GettingStarted />)
    const yes = document.querySelector('input[name="caseFilingStatus"][value="parent1/petitioner1/plaintiff"]')
    const no = document.querySelector('input[name="caseFilingStatus"][value="parent2/petitioner2/defendant"]')
    await userEvent.click(yes)
    await userEvent.click(no)
    expect(no).toBeChecked()
    expect(yes).not.toBeChecked()
  })

  it('shows the custody recipient question only when a custody order is reported and clears it when changed to No', async () => {
    renderWithRouter(<GettingStarted />)
    const yes = document.querySelector('input[name="courtCustodyOrderIssued"][value="yes"]')
    const no = document.querySelector('input[name="courtCustodyOrderIssued"][value="no"]')

    expect(yes).toBeInTheDocument()
    expect(no).toBeInTheDocument()
    expect(screen.queryByText('Which parent was granted custody of the child(ren)?')).not.toBeInTheDocument()

    await userEvent.click(yes)
    expect(screen.getByText('Which parent was granted custody of the child(ren)?')).toBeInTheDocument()

    const grantedToMe = document.querySelector('input[name="custodyGrantedTo"][value="me"]')
    await userEvent.click(grantedToMe)
    expect(grantedToMe).toBeChecked()

    await userEvent.click(no)
    expect(screen.queryByText('Which parent was granted custody of the child(ren)?')).not.toBeInTheDocument()

    await userEvent.click(yes)
    expect(document.querySelector('input[name="custodyGrantedTo"][value="me"]')).not.toBeChecked()
  })

  // ─── Children Section — Initial State ────────────────────────────────────

  it('renders one child card by default', () => {
    renderWithRouter(<GettingStarted />)
    expect(screen.getByText('Child 1')).toBeInTheDocument()
    expect(screen.queryByText('Child 2')).not.toBeInTheDocument()
  })

  it('renders child First Name and Last Name fields', () => {
    renderWithRouter(<GettingStarted />)
    expect(screen.getAllByLabelText(/First Name/i).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByLabelText(/Last Name/i).length).toBeGreaterThanOrEqual(1)
  })

  it('renders the Date of Birth field for the first child', () => {
    renderWithRouter(<GettingStarted />)
    expect(screen.getByLabelText(/Date of Birth/i)).toBeInTheDocument()
  })

  it('renders child classification checkboxes', () => {
    renderWithRouter(<GettingStarted />)
    expect(document.querySelector('#child-1-under-18')).toBeInTheDocument()
    expect(document.querySelector('#child-1-disabled')).toBeInTheDocument()
    expect(document.querySelector('#child-1-emancipated-adult')).toBeInTheDocument()
  })

  it('displays the child classification label text', () => {
    renderWithRouter(<GettingStarted />)
    expect(screen.getByText('Child Classification')).toBeInTheDocument()
  })

  it('displays the under-18 classification label', () => {
    renderWithRouter(<GettingStarted />)
    expect(screen.getByText('My child is under 18.')).toBeInTheDocument()
    expect(screen.getByText(/My child is mentally or physically disabled/i)).toBeInTheDocument()
  })

  it('displays the emancipated classification label', () => {
    renderWithRouter(<GettingStarted />)
    expect(screen.getByText('My child is an emancipated adult.')).toBeInTheDocument()
  })

  it('no child classification is checked by default', () => {
    renderWithRouter(<GettingStarted />)
    expect(document.querySelector('#child-1-under-18')).not.toBeChecked()
    expect(document.querySelector('#child-1-disabled')).not.toBeChecked()
    expect(document.querySelector('#child-1-emancipated-adult')).not.toBeChecked()
  })

  it('can select "under 18" classification for child 1', async () => {
    renderWithRouter(<GettingStarted />)
    const checkbox = document.querySelector('#child-1-under-18')
    await userEvent.click(checkbox)
    expect(checkbox).toBeChecked()
  })

  it('can select "emancipated adult" classification for child 1', async () => {
    renderWithRouter(<GettingStarted />)
    const checkbox = document.querySelector('#child-1-emancipated-adult')
    await userEvent.click(checkbox)
    expect(checkbox).toBeChecked()
  })

  it('updates child date of birth', () => {
    renderWithRouter(<GettingStarted />)
    const dateInput = screen.getByLabelText(/Date of Birth/i)
    fireEvent.change(dateInput, { target: { value: '2015-06-15' } })
    expect(dateInput).toHaveValue('2015-06-15')
  })

  it('does not show Remove button when there is only one child', () => {
    renderWithRouter(<GettingStarted />)
    expect(screen.queryByRole('button', { name: /remove child 1/i })).not.toBeInTheDocument()
  })

  it('shows the Add Another Child button', () => {
    renderWithRouter(<GettingStarted />)
    expect(screen.getByRole('button', { name: /add another child/i })).toBeInTheDocument()
  })

  // ─── Children Section — Add Children ─────────────────────────────────────

  it('adds a second child card when Add Another Child is clicked', async () => {
    renderWithRouter(<GettingStarted />)
    await userEvent.click(screen.getByRole('button', { name: /add another child/i }))
    expect(screen.getByText('Child 2')).toBeInTheDocument()
  })

  it('adds multiple children sequentially', async () => {
    renderWithRouter(<GettingStarted />)
    const addButton = screen.getByRole('button', { name: /add another child/i })
    await userEvent.click(addButton)
    await userEvent.click(addButton)
    await userEvent.click(addButton)
    expect(screen.getByText('Child 1')).toBeInTheDocument()
    expect(screen.getByText('Child 2')).toBeInTheDocument()
    expect(screen.getByText('Child 3')).toBeInTheDocument()
    expect(screen.getByText('Child 4')).toBeInTheDocument()
  })

  it('newly added children have empty input fields', async () => {
    renderWithRouter(<GettingStarted />)
    await userEvent.click(screen.getByRole('button', { name: /add another child/i }))
    const firstNameInputs = screen.getAllByLabelText(/First Name/i)
    expect(firstNameInputs[firstNameInputs.length - 1]).toHaveValue('')
  })

  it('each child has unique IDs for their inputs', async () => {
    renderWithRouter(<GettingStarted />)
    await userEvent.click(screen.getByRole('button', { name: /add another child/i }))
    const childrenSection = document.querySelector('.children-section')
    const firstNameInputs = childrenSection.querySelectorAll('input[id$="-firstName"]')
    expect(firstNameInputs[0]).toHaveAttribute('id', 'child-1-firstName')
    expect(firstNameInputs[1]).toHaveAttribute('id', 'child-2-firstName')
  })

  it('renders classification checkboxes for a newly added child', async () => {
    renderWithRouter(<GettingStarted />)
    await userEvent.click(screen.getByRole('button', { name: /add another child/i }))
    expect(document.querySelector('#child-2-under-18')).toBeInTheDocument()
    expect(document.querySelector('#child-2-disabled')).toBeInTheDocument()
    expect(document.querySelector('#child-2-emancipated-adult')).toBeInTheDocument()
  })

  it('each child has independent input fields', async () => {
    renderWithRouter(<GettingStarted />)
    await userEvent.click(screen.getByRole('button', { name: /add another child/i }))
    const firstNameInputs = screen.getAllByLabelText(/First Name/i)
    fireEvent.change(firstNameInputs[0], { target: { value: 'Alice' } })
    fireEvent.change(firstNameInputs[1], { target: { value: 'Bob' } })
    expect(firstNameInputs[0]).toHaveValue('Alice')
    expect(firstNameInputs[1]).toHaveValue('Bob')
  })

  // ─── Children Section — Remove Children ──────────────────────────────────

  it('shows Remove buttons when there are two children', async () => {
    renderWithRouter(<GettingStarted />)
    await userEvent.click(screen.getByRole('button', { name: /add another child/i }))
    expect(screen.getByRole('button', { name: /remove child 1/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /remove child 2/i })).toBeInTheDocument()
  })

  it('removes a child card when the Remove button is clicked', async () => {
    renderWithRouter(<GettingStarted />)
    await userEvent.click(screen.getByRole('button', { name: /add another child/i }))
    await userEvent.click(screen.getByRole('button', { name: /remove child 2/i }))
    expect(screen.queryByText('Child 2')).not.toBeInTheDocument()
    expect(screen.getByText('Child 1')).toBeInTheDocument()
  })

  it('can remove any child, not just the last one', async () => {
    renderWithRouter(<GettingStarted />)
    const addButton = screen.getByRole('button', { name: /add another child/i })
    await userEvent.click(addButton)
    await userEvent.click(addButton)
    await userEvent.click(screen.getByRole('button', { name: /remove child 2/i }))
    expect(screen.getByText('Child 1')).toBeInTheDocument()
    expect(screen.getByText('Child 2')).toBeInTheDocument()
    expect(screen.queryByText('Child 3')).not.toBeInTheDocument()
  })

  it('cannot remove the last remaining child', () => {
    renderWithRouter(<GettingStarted />)
    expect(screen.queryByRole('button', { name: /remove/i })).not.toBeInTheDocument()
  })

  it('hides Remove button when back down to one child', async () => {
    renderWithRouter(<GettingStarted />)
    await userEvent.click(screen.getByRole('button', { name: /add another child/i }))
    await userEvent.click(screen.getByRole('button', { name: /remove child 2/i }))
    expect(screen.queryByRole('button', { name: /remove child 1/i })).not.toBeInTheDocument()
  })

  it('maintains data for remaining children after removal', async () => {
    renderWithRouter(<GettingStarted />)
    const addButton = screen.getByRole('button', { name: /add another child/i })
    await userEvent.click(addButton)
    await userEvent.click(addButton)
    const firstNameInputs = screen.getAllByLabelText(/First Name/i)
    fireEvent.change(firstNameInputs[0], { target: { value: 'John' } })
    await userEvent.click(screen.getByRole('button', { name: /remove child 2/i }))
    const remainingFirstNameInputs = screen.getAllByLabelText(/First Name/i)
    expect(remainingFirstNameInputs[0]).toHaveValue('John')
  })

  // ─── Children Section — Complex Workflows ────────────────────────────────

  it('can add, remove, and add again', async () => {
    renderWithRouter(<GettingStarted />)
    const addButton = screen.getByRole('button', { name: /add another child/i })
    await userEvent.click(addButton)
    expect(screen.getByText('Child 2')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /remove child 2/i }))
    expect(screen.queryByText('Child 2')).not.toBeInTheDocument()
    await userEvent.click(addButton)
    expect(screen.getByText('Child 2')).toBeInTheDocument()
  })

  it('renumbers children labels after removal', async () => {
    renderWithRouter(<GettingStarted />)
    const addButton = screen.getByRole('button', { name: /add another child/i })
    await userEvent.click(addButton)
    await userEvent.click(addButton)
    expect(screen.getByText('Child 3')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /remove child 1/i }))
    expect(screen.getByText('Child 1')).toBeInTheDocument()
    expect(screen.getByText('Child 2')).toBeInTheDocument()
    expect(screen.queryByText('Child 3')).not.toBeInTheDocument()
  })

  // ─── Validation ───────────────────────────────────────────────────────────

/* TODO - Validation tests
  it('does not show errors before the form is submitted', () => {
    renderWithRouter(<GettingStarted />)
    expect(screen.queryByText('Please select an option to continue')).not.toBeInTheDocument()
    expect(screen.queryByText('First name is required')).not.toBeInTheDocument()
  })

  it('shows collaboration mode error when Next is clicked with no safety selection', async () => {
    renderWithRouter(<GettingStarted />)
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    const errors = await screen.findAllByText('Please select an option to continue')
    expect(errors.length).toBeGreaterThanOrEqual(1)
    const safetySection = document.querySelector('.safety-privacy-section')
    expect(safetySection.querySelector('.radio-group-error')).toBeInTheDocument()
  })

  it('shows collaboration mode error when "no-private" is selected but not confirmed', async () => {
    renderWithRouter(<GettingStarted />)
    await selectSafetyOption('no-private')
    // confirmation panel is shown but user hasn't clicked either button
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    const safetySection = document.querySelector('.safety-privacy-section')
    expect(safetySection.querySelector('.radio-group-error')).toBeInTheDocument()
  })

  it('shows parent first name error when Next is clicked with empty first name', async () => {
    renderWithRouter(<GettingStarted />)
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    expect(await screen.findByText('First name is required')).toBeInTheDocument()
  })

  it('shows parent last name error when Next is clicked with empty last name', async () => {
    renderWithRouter(<GettingStarted />)
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    expect(await screen.findByText('Last name is required')).toBeInTheDocument()
  })

  it('shows phone number error when Next is clicked with empty phone', async () => {
    renderWithRouter(<GettingStarted />)
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    expect(await screen.findByText('Phone number is required')).toBeInTheDocument()
  })

  it('shows address error when Next is clicked with empty address', async () => {
    renderWithRouter(<GettingStarted />)
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    expect(await screen.findByText('Address is required')).toBeInTheDocument()
  })

  it('shows child first name error when Next is clicked with empty child first name', async () => {
    renderWithRouter(<GettingStarted />)
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    expect(await screen.findByText('Child 1 first name is required')).toBeInTheDocument()
  })

  it('shows child last name error when Next is clicked with empty child last name', async () => {
    renderWithRouter(<GettingStarted />)
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    expect(await screen.findByText('Child 1 last name is required')).toBeInTheDocument()
  })

  it('shows child date of birth error when Next is clicked with no date of birth', async () => {
    renderWithRouter(<GettingStarted />)
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    expect(await screen.findByText('Child 1 date of birth is required')).toBeInTheDocument()
  })

  it('shows child classification error when Next is clicked with no classification', async () => {
    renderWithRouter(<GettingStarted />)
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    expect(await screen.findByText('Child 1 classification is required')).toBeInTheDocument()
  })

  it('clears the collaboration mode error after selecting an option', async () => {
    renderWithRouter(<GettingStarted />)
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    await screen.findAllByText('Please select an option to continue')
    await selectSafetyOption('collaborative')
    const safetySection = document.querySelector('.safety-privacy-section')
    expect(safetySection.querySelector('.radio-group-error')).not.toBeInTheDocument()
  })

  it('clears the collaboration mode error after confirming "no-private"', async () => {
    renderWithRouter(<GettingStarted />)
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    await screen.findAllByText('Please select an option to continue')
    await selectSafetyOption('no-private')
    await userEvent.click(screen.getByRole('button', { name: /yes, i'm sure/i }))
    const safetySection = document.querySelector('.safety-privacy-section')
    expect(safetySection.querySelector('.radio-group-error')).not.toBeInTheDocument()
  })

  it('clears the first name error after typing in the field', async () => {
    renderWithRouter(<GettingStarted />)
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    await screen.findByText('First name is required')
    await userEvent.type(document.querySelector('#firstParentFirstName'), 'Jane')
    expect(screen.queryByText('First name is required')).not.toBeInTheDocument()
  })

  it('does not navigate when Next is clicked with an empty form', async () => {
    renderWithRouter(<GettingStarted />)
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('does not navigate when "no-private" is selected but not confirmed', async () => {
    renderWithRouter(<GettingStarted />)
    await selectSafetyOption('no-private')
    // Fill everything else but don't confirm the sub-flow
    await userEvent.type(document.querySelector('#firstParentFirstName'), 'Jane')
    await userEvent.type(document.querySelector('#firstParentLastName'), 'Doe')
    await userEvent.type(document.querySelector('#firstParentPhone'), '555-555-5555')
    await userEvent.type(document.querySelector('#firstParentAddress'), '123 Main St')
    await userEvent.click(document.querySelector('input[name="caseFilingStatus"][value="parent1/petitioner1/plaintiff"]'))
    await userEvent.type(document.querySelector('#child-1-firstName'), 'Alex')
    await userEvent.type(document.querySelector('#child-1-lastName'), 'Doe')
    fireEvent.change(document.querySelector('#child-1-dateOfBirth'), { target: { value: '2015-06-15' } })
    await userEvent.click(document.querySelector('input[name="child-1-classification"][value="minor"]'))
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    expect(mockNavigate).not.toHaveBeenCalled()
  })
    */

  // ─── Footer Navigation ────────────────────────────────────────────────────

  /* TODO: Navigation tests once flow is finalized
  it('renders the Next and Back buttons', () => {
    renderWithRouter(<GettingStarted />)
    expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument()
  })

  it('navigates to "/" when Back is clicked', async () => {
    renderWithRouter(<GettingStarted />)
    await userEvent.click(screen.getByRole('button', { name: /back/i }))
    expect(mockNavigate).toHaveBeenCalledWith('/')
  })

  it('navigates to /parental-rights on valid form submission with "collaborative"', async () => {
    renderWithRouter(<GettingStarted />)
    await fillValidForm()
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    expect(mockNavigate).toHaveBeenCalledWith('/parental-rights')
  })

  
  it('navigates to /parental-rights on valid form submission with "yes" (locked-individual)', async () => {
    renderWithRouter(<GettingStarted />)
    await selectSafetyOption('yes')
    await userEvent.type(document.querySelector('#firstParentFirstName'), 'Jane')
    await userEvent.type(document.querySelector('#firstParentLastName'), 'Doe')
    await userEvent.type(document.querySelector('#firstParentPhone'), '555-555-5555')
    await userEvent.type(document.querySelector('#firstParentAddress'), '123 Main St, Columbus, OH 43215')
    await userEvent.click(document.querySelector('input[name="caseFilingStatus"][value="parent1/petitioner1/plaintiff"]'))
    await userEvent.type(document.querySelector('#child-1-firstName'), 'Alex')
    await userEvent.type(document.querySelector('#child-1-lastName'), 'Doe')
    fireEvent.change(document.querySelector('#child-1-dateOfBirth'), { target: { value: '2015-06-15' } })
    await userEvent.click(document.querySelector('input[name="child-1-classification"][value="minor"]'))
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    expect(mockNavigate).toHaveBeenCalledWith('/parental-rights')
  })
  

 
    it('navigates to /parental-rights after confirming "no-private" (individual mode)', async () => {
      renderWithRouter(<GettingStarted />)
      await selectSafetyOption('no-private')
      await userEvent.click(screen.getByRole('button', { name: /yes, i'm sure/i }))
      await userEvent.type(document.querySelector('#firstParentFirstName'), 'Jane')
      await userEvent.type(document.querySelector('#firstParentLastName'), 'Doe')
      await userEvent.type(document.querySelector('#firstParentPhone'), '555-555-5555')
      await userEvent.type(document.querySelector('#firstParentAddress'), '123 Main St, Columbus, OH 43215')
      await userEvent.click(document.querySelector('input[name="caseFilingStatus"][value="parent1/petitioner1/plaintiff"]'))
      await userEvent.type(document.querySelector('#child-1-firstName'), 'Alex')
      await userEvent.type(document.querySelector('#child-1-lastName'), 'Doe')
      fireEvent.change(document.querySelector('#child-1-dateOfBirth'), { target: { value: '2015-06-15' } })
      await userEvent.click(document.querySelector('input[name="child-1-classification"][value="minor"]'))
      fireEvent.click(screen.getByRole('button', { name: /next/i }))
      expect(mockNavigate).toHaveBeenCalledWith('/parental-rights')
    })
    

    */
  // ─── Global State / Persistence ───────────────────────────────────────────

  it('persists "yes" safety selection when returning to the page', async () => {
    const { unmount } = renderWithRouter(<GettingStarted />)
    await selectSafetyOption('yes')
    unmount()
    renderWithRouter(<GettingStarted />)
    expect(document.querySelector('input[name="safetyConcern"][value="yes"]')).toBeChecked()
  })

  it('persists "collaborative" selection when returning to the page', async () => {
    const { unmount } = renderWithRouter(<GettingStarted />)
    await selectSafetyOption('collaborative')
    unmount()
    renderWithRouter(<GettingStarted />)
    expect(document.querySelector('input[name="safetyConcern"][value="collaborative"]')).toBeChecked()
  })

  it('persists "no-private" selection (after confirmation) when returning to the page', async () => {
    const { unmount } = renderWithRouter(<GettingStarted />)
    await selectSafetyOption('no-private')
    await userEvent.click(screen.getByRole('button', { name: /yes, i'm sure/i }))
    unmount()
    renderWithRouter(<GettingStarted />)
    expect(document.querySelector('input[name="safetyConcern"][value="no-private"]')).toBeChecked()
  })

  it('persists case filing status selection when returning to the page', async () => {
    const { unmount } = renderWithRouter(<GettingStarted />)
    await userEvent.click(document.querySelector('input[name="caseFilingStatus"][value="parent2/petitioner2/defendant"]'))
    unmount()
    renderWithRouter(<GettingStarted />)
    expect(document.querySelector('input[name="caseFilingStatus"][value="parent2/petitioner2/defendant"]')).toBeChecked()
  })

  it('persists parent first name when returning to the page', async () => {
    const { unmount } = renderWithRouter(<GettingStarted />)
    await userEvent.type(document.querySelector('#firstParentFirstName'), 'Jane')
    unmount()
    renderWithRouter(<GettingStarted />)
    expect(document.querySelector('#firstParentFirstName')).toHaveValue('Jane')
  })
})