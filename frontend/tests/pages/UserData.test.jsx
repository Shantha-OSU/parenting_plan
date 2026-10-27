import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import UserData from '../../src/pages/UserData';

describe('UserData', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders aggregate metrics and demographic distributions', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([
        { parentAge: 30, gender: 'Woman', race: ['White', 'Asian'] },
        { parentAge: 40, gender: 'Woman', race: ['White'] },
        { parentAge: null, gender: 'Man', race: [] }
      ])
    });

    render(<UserData />);

    expect(await screen.findByRole('heading', { name: 'Aggregate data dashboard' })).toBeInTheDocument();
    expect(screen.getByText('Plans represented')).toBeInTheDocument();
    expect(screen.getByText('Average parent age')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Gender distribution across 3 selections' })).toBeInTheDocument();
    expect(screen.getByText('Race / ethnicity')).toBeInTheDocument();
    expect(screen.getByText('Woman')).toBeInTheDocument();
    expect(screen.getByText('66.7%')).toBeInTheDocument();
    expect(screen.getByText(/total reflects plans, not unique users/i)).toBeInTheDocument();
  });

  it('shows an empty state when the API returns no aggregate records', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([])
    });

    render(<UserData />);

    expect(await screen.findByText('No responses yet')).toBeInTheDocument();
    expect(screen.getAllByText('No responses yet')).toHaveLength(9);
  });
});
