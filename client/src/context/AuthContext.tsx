import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { api } from '../api/client';

export type UserRole = 'ADMIN' | 'MANAGER' | 'RECEPTIONIST' | 'HOUSEKEEPING';

export interface AuthUser {
  id: string;
  username: string;
  email?: string | null;
  name: string;
  role: UserRole;
  avatar?: string;
}

interface AuthContextProps {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextProps | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('naturalodge_token');
    if (!token) {
      setIsLoading(false);
      return;
    }
    api.get<AuthUser>('/auth/me')
      .then((res) => setUser(res.data))
      .catch(() => localStorage.removeItem('naturalodge_token'))
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const { data } = await api.post<{ token: string; user: AuthUser }>('/auth/login', { username, password });
    localStorage.setItem('naturalodge_token', data.token);
    setUser(data.user);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('naturalodge_token');
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, isAuthenticated: !!user, isLoading, login, logout }),
    [user, isLoading, login, logout]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
