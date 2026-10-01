'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from 'react';
import { authService, CurrentUser } from '@/src/services/auth.service';

interface AuthContextValue {
  user: CurrentUser | null;
  loading: boolean;
  isLoggedIn: boolean;
  loginWithGoogle: (data: {
    credential?: string;
    email: string;
    full_name?: string;
    avatar_url?: string;
    role?: any;
  }) => Promise<CurrentUser>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
};

/** AuthProvider — single source of truth for the session.
 *  Reads from authService (localStorage + token validation) and re-syncs on
 *  cross-tab logouts / same-tab custom events emitted by auth.service. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(authService.getUser());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setUser(authService.isLoggedIn() ? authService.getUser() : null);
    setLoading(false);

    const sync = () => setUser(authService.getUser());
    window.addEventListener('edumap-auth-login', sync);
    window.addEventListener('edumap-auth-logout', sync);

    const onStorage = (e: StorageEvent) => {
      if (
        e.key === 'edumap-access-token' ||
        e.key === 'edumap-user-info'
      ) {
        sync();
      }
    };
    window.addEventListener('storage', onStorage);

    return () => {
      window.removeEventListener('edumap-auth-login', sync);
      window.removeEventListener('edumap-auth-logout', sync);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const loginWithGoogle = async (data: {
    credential?: string;
    email: string;
    full_name?: string;
    avatar_url?: string;
    role?: any;
  }) => {
    const u = await authService.loginWithGoogle(data);
    setUser(u);
    return u;
  };

  const logout = () => {
    authService.logout();
    setUser(null);
  };

  const refreshUser = async () => {
    try {
      const u = await authService.fetchUserProfile();
      setUser(u);
    } catch {
      setUser(null);
    }
  };

  const value = useMemo(
    () => ({
      user,
      loading,
      isLoggedIn: !!user,
      loginWithGoogle,
      logout,
      refreshUser,
    }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
