import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { FormProvider } from '../../src/context/FormContext';
import { NavigationProvider, useNavigation } from '../../src/context/NavigationContext';
import MainLayout from '../../src/layouts/MainLayout';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockGetIdToken = vi.fn().mockResolvedValue('mock-token');
const mockUser = { getIdToken: mockGetIdToken };

vi.mock('../../src/lib/firebase', () => ({
  auth: {},
}));

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (_auth, callback) => {
    callback(mockUser);
    return () => {}; 
  },
  signOut: vi.fn(),
}));

const mockNextQuestion = { section: 'parental-rights', qKey: 'q1', options: [] };
const mockPrevQuestion = { section: 'getting-started', qKey: 'q0', options: [] };
const mockPlan = { _id: 'plan-1', children: [] };

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.removeItem('sharedCareForm');
  global.fetch = vi.fn((url) => {
    if (url.includes('prevQuestion')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockPrevQuestion),
      });
    }
    if (url.includes('nextQuestionWithContext')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockNextQuestion),
      });
    }
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve(mockPlan),
    });
  });
});

const TestComponent = () => <div>Test Child Content</div>;

const renderWithProviders = (initialRoute = '/getting-started') => {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <FormProvider>
        <NavigationProvider>
          <MainLayout>
            <TestComponent />
          </MainLayout>
        </NavigationProvider>
      </FormProvider>
    </MemoryRouter>
  );
};

describe('MainLayout', () => {
  // Basic rendering
  it('renders without crashing', () => {
    renderWithProviders();
  });

  it('renders children content', () => {
    renderWithProviders();
    expect(screen.getByText('Test Child Content')).toBeInTheDocument();
  });

  it('renders sidebar', () => {
    renderWithProviders();
    expect(screen.getByText('Navigate Sections')).toBeInTheDocument();
  });

  it('renders header', () => {
    renderWithProviders();
    expect(document.querySelector('.header')).toBeInTheDocument();
  });

  it('renders footer', () => {
    renderWithProviders();
    expect(document.querySelector('.footer')).toBeInTheDocument();
  });

  // Sidebar collapse functionality
  it('sidebar is expanded by default', () => {
    renderWithProviders();
    const sidebar = document.querySelector('.sidebar');
    expect(sidebar).not.toHaveClass('sidebar--collapsed');
  });

  it('can toggle sidebar collapse', () => {
    renderWithProviders();
    const toggleButton = screen.getByRole('button', { name: /collapse sidebar/i });
    fireEvent.click(toggleButton);
    expect(document.querySelector('.sidebar')).toHaveClass('sidebar--collapsed');
  });

  it('toggle button changes label when collapsed', () => {
    renderWithProviders();
    const toggleButton = screen.getByRole('button', { name: /collapse sidebar/i });
    fireEvent.click(toggleButton);
    expect(screen.getByRole('button', { name: /expand sidebar/i })).toBeInTheDocument();
  });

  // Footer navigation button visibility
  it('hides back button on first page', () => {
    renderWithProviders('/getting-started');
    expect(screen.queryByRole('button', { name: /back/i })).not.toBeInTheDocument();
  });

  it('shows back button on subsequent pages', () => {
    renderWithProviders('/parental-rights');
    expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument();
  });

  it('shows next button on non-final pages', () => {
    renderWithProviders('/getting-started');
    expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument();
  });

  it('hides next button on last page', () => {
    renderWithProviders('/review');
    expect(screen.queryByRole('button', { name: /next/i })).not.toBeInTheDocument();
  });

  it('navigates forward when next button is clicked on getting-started', async () => {
    localStorage.setItem('sharedCareForm', JSON.stringify({
      plan: {
        _id: 'plan-1',
        collaborationMode: 'individual',
        children: [],
        aggregateData: {},
        currentCircumstance: 'married',
      },
      parents: {
        firstName: 'Alex',
        lastName: 'Parent',
        age: '30',
        phone: '',
        streetAddress: '',
        addressLine2: '',
        city: '',
        state: '',
        zipCode: '',
      },
      question: {},
      currAnswer: '',
    }));
    renderWithProviders('/getting-started');
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/parental-rights');
    });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('nextQuestionWithContext'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ planId: 'plan-1', startQKey: 'allocation_parental_rights' }),
      }),
    );
  });

  it('navigates backward when back button is clicked', async () => {
    renderWithProviders('/parental-rights');
    fireEvent.click(screen.getByRole('button', { name: /back/i }));
    await waitFor(() => {
      // prevQuestion returns section: 'getting-started'
      expect(mockNavigate).toHaveBeenCalledWith('/getting-started');
    });
  });

  it('does not crash when next is clicked with no callback registered', () => {
    renderWithProviders('/getting-started');
    expect(() =>
      fireEvent.click(screen.getByRole('button', { name: /next/i }))
    ).not.toThrow();
  });

  it('layout main section has correct class when sidebar is expanded', () => {
    renderWithProviders();
    expect(document.querySelector('.layout__main')).not.toHaveClass('layout__main--sidebar-collapsed');
  });

  it('layout main section has collapsed class when sidebar is collapsed', () => {
    renderWithProviders();
    fireEvent.click(screen.getByRole('button', { name: /collapse sidebar/i }));
    expect(document.querySelector('.layout__main')).toHaveClass('layout__main--sidebar-collapsed');
  });
});