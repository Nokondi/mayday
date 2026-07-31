import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { setAccessToken, getAccessToken, REQUEST_TIMEOUT_MS } from '../api/client.js';
import * as authApi from '../api/auth.js';
import { reportClientError } from '../utils/diagnostics.js';
import axios from 'axios';
import type { RegisterRequest, LoginRequest } from '@mayday/shared';

interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  avatarUrl: string | null;
  // Present when the user came from GET /auth/me (PushBootstrap reads it);
  // may be absent on the login response.
  pushNotificationsEnabled?: boolean;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  login: (data: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<{ message: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

// A failure with no HTTP response — timeout, dropped or dead connection — as
// opposed to a server "no" (401 etc.). Before request timeouts were added,
// these were the failures that could hang the boot spinner indefinitely.
function isNetworkError(err: unknown): boolean {
  return axios.isAxiosError(err) && !err.response;
}

// Retry a request once when it fails at the network level. A mobile
// browser/PWA resuming from suspension often fires its first request over a
// dead keep-alive connection; the second attempt goes out over a fresh one.
// Server responses (401 = not logged in) are not retried.
async function withOneRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (!isNetworkError(err)) throw err;
    return fn();
  }
}

// Boot-time network failures produce no error event, so without an explicit
// beacon they are invisible in the server logs (unlike crashes, which
// installDiagnostics catches).
function beaconIfNetworkError(step: string, err: unknown): void {
  if (!isNetworkError(err)) return;
  const code = axios.isAxiosError(err) ? err.code ?? 'unknown' : 'unknown';
  const message = err instanceof Error ? err.message : String(err);
  reportClientError({
    kind: 'auth-init-network-error',
    detail: `${step}: ${code}: ${message}`,
  });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    const init = async () => {
      // If there's no access token in memory (e.g. after a page refresh),
      // try to obtain one using the refresh token cookie.
      if (!getAccessToken()) {
        try {
          const { data } = await withOneRetry(() =>
            axios.post('/api/auth/refresh', {}, { withCredentials: true, timeout: REQUEST_TIMEOUT_MS }),
          );
          setAccessToken(data.accessToken);
        } catch (err) {
          // No valid refresh token — user is not logged in. On a network
          // failure the user may actually have a session, but rendering the
          // logged-out UI beats spinning forever; beacon it so we can see how
          // often boot hits this path.
          beaconIfNetworkError('refresh', err);
          setUser(null);
          setIsLoading(false);
          return;
        }
      }

      try {
        const data = await withOneRetry(() => authApi.getMe());
        setUser(data);
      } catch (err) {
        beaconIfNetworkError('getMe', err);
        setUser(null);
        setAccessToken(null);
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, []);

  const login = useCallback(async (data: LoginRequest) => {
    const res = await authApi.login(data);
    setAccessToken(res.accessToken);
    queryClient.clear();
    setUser(res.user);
  }, [queryClient]);

  const register = useCallback(async (data: RegisterRequest) => {
    const res = await authApi.register(data);
    // Registration does not log the user in — they must confirm their email first.
    return { message: res.message };
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout();
    setAccessToken(null);
    queryClient.clear();
    setUser(null);
  }, [queryClient]);

  const refreshUser = useCallback(async () => {
    try {
      const data = await authApi.getMe();
      setUser(data);
    } catch {
      // ignore — user state unchanged
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
