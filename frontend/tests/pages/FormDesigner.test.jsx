import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import FormDesigner, { answerText, FormTemplatePrintDocument } from '../../src/pages/FormDesigner'
import { CUSTOM_COMPARISON_QUESTIONS } from '../../src/lib/comparisonQuestionDefinitions'
import { renderWithRouter } from '../../src/utils/renderWithRouter'

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: vi.fn((_auth, callback) => {
    callback(null)
    return vi.fn()
  }),
}))

vi.mock('../../src/lib/firebase', () => ({ auth: {} }))

vi.stubGlobal('fetch', vi.fn((url) => {
  if (String(url).includes('/api/logic-engine/questions')) {
    return Promise.resolve({
      ok: true,
      json: async () => [{ qKey: 'parentalRights.test', qText: 'Sample parental-rights question', section: 'parental-rights' }],
    })
  }
  return Promise.resolve({ ok: true, json: async () => ({}) })
}))

describe('FormDesigner', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.mocked(fetch).mockClear()
  })

  it('renders the blank designer and both PDF formats', async () => {
    renderWithRouter(<FormDesigner />)

    expect(screen.getByRole('heading', { name: 'Form Designer' })).toBeInTheDocument()
    expect(screen.getByLabelText('Document title')).toHaveValue('Parenting Plan Questionnaire Responses')
    expect(screen.getByRole('option', { name: 'Review PDF' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Comparison PDF' })).toBeInTheDocument()
    await waitFor(() => expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/logic-engine/questions'),
    ))
  })

  it('adds editable document text and switches PDF formats', async () => {
    renderWithRouter(<FormDesigner />)

    await userEvent.click(screen.getByRole('button', { name: /add section heading/i }))
    expect(screen.getAllByRole('textbox').length).toBeGreaterThan(1)

    await userEvent.selectOptions(screen.getByLabelText('PDF format'), 'comparison')
    expect(screen.getByLabelText('Document title')).toHaveValue('Merged Parenting Plan Responses')
  })

  it('shows the question-pages palette', async () => {
    renderWithRouter(<FormDesigner />)

    expect(await screen.findByRole('tab', { name: 'Personal info' })).toBeInTheDocument()
    expect(screen.getByRole('tablist', { name: 'Question pages' })).toBeInTheDocument()
  })

  it('shows readable Information Sharing question labels', async () => {
    localStorage.setItem('shareCareFormTemplate:review', JSON.stringify({
      title: 'Comparison',
      blocks: [{ id: 'intro', type: 'heading', text: 'Questionnaire Responses' }],
    }))
    renderWithRouter(<FormDesigner />)

    await userEvent.click(await screen.findByRole('tab', { name: 'Information Sharing' }))
    expect(screen.getAllByText('Medical information access').length).toBeGreaterThan(0)
    expect(screen.getAllByText('School contact rights').length).toBeGreaterThan(0)
    expect(screen.getAllByText('School activity participation').length).toBeGreaterThan(0)
  })

  it('uses readable Information Sharing labels in shared comparison metadata', () => {
    expect(CUSTOM_COMPARISON_QUESTIONS['informationSharing.medicalRecords'].qText)
      .toBe('Medical information access')
    expect(CUSTOM_COMPARISON_QUESTIONS['informationSharing.schoolContact'].qText)
      .toBe('School contact rights')
    expect(CUSTOM_COMPARISON_QUESTIONS['informationSharing.schoolActivities'].qText)
      .toBe('School activity participation')
  })

  it('uses address-specific labels for the school-address parent question', () => {
    const question = CUSTOM_COMPARISON_QUESTIONS.school_address_parent
    expect(question.options).toEqual(expect.arrayContaining([
      { value: 'me', label: 'Just my address' },
      { value: 'coParent', label: "Just my co-parent's address" },
    ]))
    expect(answerText('me', question)).toBe('Just my address')
    expect(answerText('coParent', question)).toBe("Just my co-parent's address")
  })

  it('formats both parents tax years for odd, even, and custom arrangements', () => {
    const question = { childAnswers: true }
    expect(answerText({
      Alex: { intent: 'parent1SomeYears', taxYears: 'odd', userIsParent2: true },
    }, question)).toContain('Parent 1 years: Odd-numbered tax years; Parent 2 years: Even-numbered tax years')
    expect(answerText({
      Alex: { intent: 'parent1SomeYears', taxYears: 'odd', userIsParent2: true },
    }, question)).not.toContain('Alex: Parent 1 —')
    expect(answerText({
      Alex: {
        intent: 'parent2SomeYears',
        taxYears: 'custom',
        customYears: '2025, 2029',
        coParentCustomYears: '2026, 2028',
        userIsParent2: false,
      },
    }, question)).toContain('Parent 2 years: 2025, 2029; Parent 1 years: 2026, 2028')
  })

  it('prints both parent answers for items needing discussion', () => {
    render(
      <FormTemplatePrintDocument
        template={{
          title: 'Comparison',
          blocks: [{
            id: 'answer-1',
            type: 'answer',
            qKey: 'parentalRights.test',
            questionText: 'Who makes this decision?',
          }],
        }}
        answersByKey={{
          'parentalRights.test': {
            qKey: 'parentalRights.test',
            answer: 'merged answer',
            parentAnswers: { parent1: 'Parent 1 answer', parent2: 'Parent 2 answer' },
          },
        }}
        questions={{ 'parentalRights.test': { qKey: 'parentalRights.test' } }}
        needsDiscussionKeys={new Set(['parentalRights.test'])}
        parentNames={{ parent1: 'Alex', parent2: 'Jordan' }}
      />,
    )

    expect(screen.getByText("Alex's answer")).toBeInTheDocument()
    expect(screen.getByText('Parent 1 answer')).toBeInTheDocument()
    expect(screen.getByText("Jordan's answer")).toBeInTheDocument()
    expect(screen.getByText('Parent 2 answer')).toBeInTheDocument()
    expect(screen.queryByText('merged answer')).not.toBeInTheDocument()
  })
})
