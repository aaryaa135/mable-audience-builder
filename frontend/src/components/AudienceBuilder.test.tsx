import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AudienceBuilder } from './AudienceBuilder'
import { vi, describe, it, expect, beforeEach } from 'vitest'

const mockPreviewResponse = {
  name: 'Product Viewers - No Purchase',
  asOf: '2026-09-29T00:00:00.000Z',
  evaluatedUsers: 12,
  total: 6,
  members: [
    {
      anonymousId: 'anon_001',
      evidence: [
        {
          conditionIndex: 0,
          eventType: 'product_view',
          operator: 'at_least',
          required: 2,
          observedCount: 2,
          windowStart: '2026-09-22T00:00:00.000Z',
          windowEnd: '2026-09-29T00:00:00.000Z',
        },
        {
          conditionIndex: 1,
          eventType: 'purchase',
          operator: 'exactly',
          required: 0,
          observedCount: 0,
          windowStart: '2026-09-22T00:00:00.000Z',
          windowEnd: '2026-09-29T00:00:00.000Z',
        },
      ],
    },
  ],
}

// Use a mock implementation that can handle multiple calls
function setupFetchMocks(responses: Array<{ response: unknown; ok: boolean; status: number }>) {
  let callIndex = 0
  vi.mocked(fetch).mockImplementation(async () => {
    const config = responses[callIndex] ?? responses[responses.length - 1]
    callIndex++
    return {
      ok: config.ok,
      status: config.status,
      json: async () => config.response,
    } as Response
  })
}

function renderBuilder() {
  return render(<AudienceBuilder />)
}

describe('AudienceBuilder', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders default rule with product_view at_least 2 and purchase exactly 0', () => {
    renderBuilder()

    // Check default audience name
    expect(screen.getByDisplayValue('Product Viewers - No Purchase')).toBeInTheDocument()

    // Check first condition: product_view, at_least, count 2, withinDays 7
    const eventTypeSelects = screen.getAllByLabelText('Event')
    expect(eventTypeSelects).toHaveLength(2)
    expect(eventTypeSelects[0]).toHaveValue('product_view')

    const operatorSelects = screen.getAllByLabelText('Operator')
    expect(operatorSelects[0]).toHaveValue('at_least')

    const countInputs = screen.getAllByLabelText('Count')
    expect(countInputs[0]).toHaveAttribute('value', '2')

    const withinDaysInputs = screen.getAllByLabelText('Within (days)')
    expect(withinDaysInputs[0]).toHaveAttribute('value', '7')

    // Check second condition: purchase, exactly, count 0, withinDays 7
    expect(eventTypeSelects[1]).toHaveValue('purchase')
    expect(operatorSelects[1]).toHaveValue('exactly')
    expect(countInputs[1]).toHaveAttribute('value', '0')
    expect(withinDaysInputs[1]).toHaveAttribute('value', '7')
  })

  it('add condition adds a new condition row', () => {
    renderBuilder()

    // Initially 2 conditions
    expect(screen.getAllByLabelText('Event')).toHaveLength(2)

    // Click add condition button
    const addButton = screen.getByRole('button', { name: /add a new condition/i })
    fireEvent.click(addButton)

    // Now 3 conditions
    expect(screen.getAllByLabelText('Event')).toHaveLength(3)

    // New condition should have defaults
    const eventTypeSelects = screen.getAllByLabelText('Event')
    expect(eventTypeSelects[2]).toHaveValue('product_view')

    const operatorSelects = screen.getAllByLabelText('Operator')
    expect(operatorSelects[2]).toHaveValue('at_least')

    const countInputs = screen.getAllByLabelText('Count')
    expect(countInputs[2]).toHaveAttribute('value', '2')

    const withinDaysInputs = screen.getAllByLabelText('Within (days)')
    expect(withinDaysInputs[2]).toHaveAttribute('value', '7')
  })

  it('remove condition removes a condition while keeping at least one', () => {
    renderBuilder()

    // Initially 2 conditions
    const removeButtons = screen.getAllByRole('button', { name: /remove/i })
    expect(removeButtons).toHaveLength(2)

    // Remove first condition
    fireEvent.click(removeButtons[0])

    // Should have 1 condition left
    expect(screen.getAllByLabelText('Event')).toHaveLength(1)

    // Try to remove the last condition - button should not be present (canRemove=false)
    const remainingRemoveButtons = screen.queryAllByRole('button', { name: /remove/i })
    expect(remainingRemoveButtons).toHaveLength(0)
  })

  it('successful preview displays the returned audience size', async () => {
    setupFetchMocks([{ response: mockPreviewResponse, ok: true, status: 200 }])
    renderBuilder()

    // Click preview button
    const previewButton = screen.getByRole('button', { name: /preview audience/i })
    fireEvent.click(previewButton)

    // Should show loading state
    expect(screen.getByRole('button', { name: /previewing.../i })).toBeInTheDocument()

    // Wait for results
    await waitFor(() => {
      expect(screen.getByText('Preview result')).toBeInTheDocument()
    })

    // Check audience size displayed
    expect(screen.getByText('6')).toBeInTheDocument()
    expect(screen.getByText('users')).toBeInTheDocument()

    // Check evaluated users text
    expect(screen.getByText('Evaluated 12 eligible anonymous users.')).toBeInTheDocument()

    // Check member displayed
    expect(screen.getByText('anon_001')).toBeInTheDocument()
  })

  it('API failure displays the error and Retry button', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: { code: 'INTERNAL_ERROR', message: 'Server error', requestId: 'test-123' } }),
    } as Response)
    renderBuilder()

    const previewButton = screen.getByRole('button', { name: /preview audience/i })
    fireEvent.click(previewButton)

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })

    // Check error message
    expect(screen.getByText('Preview failed')).toBeInTheDocument()
    expect(screen.getByText('Server error Request ID: test-123')).toBeInTheDocument()

    // Check Retry button exists
    const retryButton = screen.getByRole('button', { name: /retry/i })
    expect(retryButton).toBeInTheDocument()
  })
})