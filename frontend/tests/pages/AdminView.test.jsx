import { render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import AdminView from '../../src/pages/AdminView';

const { authState, adminAccessAllowed } = vi.hoisted(() => ({
  authState: {
    user: {
      getIdToken: vi.fn().mockResolvedValue('admin-token')
    }
  },
  adminAccessAllowed: { value: true }
}));

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: vi.fn((auth, callback) => {
    callback(authState.user);
    return vi.fn();
  })
}));

vi.mock('../../src/lib/firebase', () => ({
  auth: {
    get currentUser() {
      return authState.user;
    }
  }
}));

beforeEach(() => {
  authState.user = { getIdToken: vi.fn().mockResolvedValue('admin-token') };
  adminAccessAllowed.value = true;
  global.fetch = vi.fn((url) => {
    if (url.includes('/api/admin/access')) {
      return Promise.resolve({
        ok: adminAccessAllowed.value,
        status: adminAccessAllowed.value ? 200 : 403
      });
    }

    return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
  });
});

function renderAdminView() {
  return render(
    <MemoryRouter>
      <AdminView />
    </MemoryRouter>
  );
}

describe('AdminView', () => {
  it('includes the aggregate data dashboard for admins', async () => {
    renderAdminView();

    expect(await screen.findByRole('heading', { name: 'Admin View' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Edit questions' })).toHaveAttribute('href', '/admin/questions');
    expect(screen.getByRole('link', { name: 'Back to dashboard' })).toHaveAttribute('href', '/dashboard');
    expect(screen.getByRole('heading', { name: 'Response distributions' })).toBeInTheDocument();
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/aggregate-data'),
        { headers: { Authorization: 'Bearer admin-token' } }
      );
    });
  });

  it('does not render aggregate data for non-admins', async () => {
    adminAccessAllowed.value = false;
    renderAdminView();

    expect(await screen.findByRole('alert')).toHaveTextContent('Administrator access required');
    expect(screen.queryByRole('heading', { name: 'Response distributions' })).not.toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalledWith(
      expect.stringContaining('/api/aggregate-data'),
      expect.anything()
    );
  });
});
