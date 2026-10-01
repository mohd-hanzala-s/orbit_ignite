import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import type { User } from './types';

interface AuthCtx {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (name: string, email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  setUser: (u: User) => void;
}
const Ctx = createContext<AuthCtx>(null!);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const qc = useQueryClient();

  const refresh = useCallback(async () => {
    try {
      const r = await api.get<{ user: User | null }>('/auth/me');
      setUser(r.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    const h = () => { setUser(null); qc.clear(); };
    window.addEventListener('orbit:unauthorized', h);
    return () => window.removeEventListener('orbit:unauthorized', h);
  }, [qc]);

  const value = useMemo<AuthCtx>(
    () => ({
      user,
      loading,
      setUser,
      refresh,
      login: async (email, password) => {
        qc.clear();
        const r = await api.post<{ user: User }>('/auth/login', { email, password });
        setUser(r.user);
        return r.user;
      },
      register: async (name, email, password) => {
        qc.clear();
        const r = await api.post<{ user: User }>('/auth/register', { name, email, password });
        setUser(r.user);
        return r.user;
      },
      logout: async () => {
        await api.post('/auth/logout').catch(() => {});
        setUser(null);
        qc.clear();
      },
    }),
    [user, loading, refresh, qc],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
