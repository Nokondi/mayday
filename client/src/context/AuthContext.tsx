import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { setAccessToken, getAccessToken } from '../api/client.js';
import * as authApi from '../api/auth.js';
import axios from 'axios';
import type { RegisterRequest, LoginRequest } from '@mayday/shared';

interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  login: (data: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      // If there's no access token in memory (e.g. after a page refresh),
      // try to obtain one using the refresh token cookie.
      if (!getAccessToken()) {
        try {
          const { data } = await axios.post('/api/auth/refresh', {}, { withCredentials: true });
          setAccessToken(data.accessToken);
        } catch {
          // No valid refresh token — user is not logged in
          setUser(null);
          setIsLoading(false);
          return;
        }
      }

      try {
        const data = await authApi.getMe();
        setUser(data);
      } catch {
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
    setUser(res.user);
  }, []);

  const register = useCallback(async (data: RegisterRequest) => {
    const res = await authApi.register(data);
    setAccessToken(res.accessToken);
    setUser(res.user);
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout();
    setAccessToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
