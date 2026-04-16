import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { ProtectedRoute } from '../../../src/components/auth/ProtectedRoute.js';
import { useAuth } from '../../../src/context/AuthContext.js';

vi.mock('../../../src/context/AuthContext.js', () => ({
  useAuth: vi.fn(),
}));

const mockedUseAuth = vi.mocked(useAuth);

function mockAuth(state: { user: unknown; isLoading: boolean }) {
  mockedUseAuth.mockReturnValue({
    ...state,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
  } as ReturnType<typeof useAuth>);
}

function renderProtected() {
  return render(
    <MemoryRouter initialEntries={['/protected']}>
      <Routes>
        <Route path="/login" element={<div>LOGIN PAGE</div>} />
        <Route
          path="/protected"
          element={
            <ProtectedRoute>
              <div>PROTECTED CONTENT</div>
            </ProtectedRoute>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProtectedRoute', () => {
  beforeEach(() => {
    mockedUseAuth.mockReset();
  });

  it('shows a loading indicator while auth is resolving', () => {
    mockAuth({ user: null, isLoading: true });
    renderProtected();

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
    // Neither the protected content nor the login page is shown while loading
    expect(screen.queryByText('PROTECTED CONTENT')).not.toBeInTheDocument();
    expect(screen.queryByText('LOGIN PAGE')).not.toBeInTheDocument();
  });

  it('redirects to /login when the user is not authenticated', () => {
    mockAuth({ user: null, isLoading: false });
    renderProtected();

    expect(screen.getByText('LOGIN PAGE')).toBeInTheDocument();
    expect(screen.queryByText('PROTECTED CONTENT')).not.toBeInTheDocument();
  });

  it('renders children when the user is authenticated', () => {
    mockAuth({
      user: { id: '1', email: 'alice@example.com', name: 'Alice', role: 'USER' },
      isLoading: false,
    });
    renderProtected();

    expect(screen.getByText('PROTECTED CONTENT')).toBeInTheDocument();
    expect(screen.queryByText('LOGIN PAGE')).not.toBeInTheDocument();
  });

  it('does not show the loading indicator once auth has resolved', () => {
    mockAuth({
      user: { id: '1', email: 'alice@example.com', name: 'Alice', role: 'USER' },
      isLoading: false,
    });
    renderProtected();

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
  });

  it('preserves the originating location in router state on redirect', () => {
    mockAuth({ user: null, isLoading: false });

    // A tiny probe component that reads location.state to prove the redirect
    // included `from`. If ProtectedRoute stops passing state, this breaks.
    function LoginProbe() {
      const location = useLocation();
      const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname;
      return <div>LOGIN PAGE from={from}</div>;
    }

    render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route path="/login" element={<LoginProbe />} />
          <Route
            path="/protected"
            element={
              <ProtectedRoute>
                <div>PROTECTED CONTENT</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText(/LOGIN PAGE from=\/protected/)).toBeInTheDocument();
  });
});
