import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import authService, { AuthUser } from '../services/auth.service';
import { apiService } from '../services/api';

export interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  twoFactorEnabled: boolean;
  isAuthenticated: boolean;
  login: (credentials: { email: string; password: string }) => Promise<AuthUser>;
  register: (payload: { email: string; password: string; full_name: string; phone?: string }) => Promise<any>;
  logout: () => Promise<void>;
  getProfile: () => Promise<any>;
  updateProfile: (data: any) => Promise<any>;
  changePassword: (old_password: string, new_password: string) => Promise<any>;
  verifyTwoFactor: (token: string) => Promise<any>;
  generate2FASecret: () => Promise<any>;
  requestPasswordReset: (email: string) => Promise<any>;
  resetPassword: (token: string, new_password: string) => Promise<any>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);

  useEffect(() => {
    // Hydrate persisted session from SecureStore on cold start.
    (async () => {
      setIsLoading(true);
      try {
        const { token, user: storedUser } = await authService.loadStoredAuth();
        if (token && storedUser) {
          setUser(storedUser);
        } else {
          setUser(null);
        }
      } catch (e) {
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const login = async (credentials: { email: string; password: string }): Promise<AuthUser> => {
    setIsLoading(true);
    try {
      const { user: loggedIn } = await authService.login(credentials.email, credentials.password);
      setUser(loggedIn);
      return loggedIn;
    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (payload: { email: string; password: string; full_name: string; phone?: string }) => {
    setIsLoading(true);
    try {
      return await authService.register(payload);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    await authService.logout();
    setUser(null);
    setTwoFactorEnabled(false);
  };

  const getProfile = async () => {
    const res = await authService.getProfile();
    const data = res?.data || res;
    if (data) {
      setTwoFactorEnabled(!!data.two_factor_enabled);
      setUser((prev) =>
        prev
          ? { ...prev, fullName: data.full_name, email: data.email }
          : { id: data.userId || data.id, email: data.email, fullName: data.full_name, role: data.role }
      );
    }
    return res;
  };

  const updateProfile = async (data: any) => {
    const res = await authService.updateProfile(data);
    const body = res?.data || res;
    setUser((prev) => (prev ? { ...prev, ...body } : prev));
    return res;
  };

  const changePassword = async (old_password: string, new_password: string) => {
    return authService.changePassword(old_password, new_password);
  };

  const verifyTwoFactor = async (token: string) => {
    const res = await authService.verifyTwoFactor(user?.id || '', token);
    return res;
  };

  const generate2FASecret = async () => {
    return authService.generate2FASecret();
  };

  const requestPasswordReset = async (email: string) => {
    return authService.forgotPassword(email);
  };

  const resetPassword = async (token: string, new_password: string) => {
    return authService.resetPassword(token, new_password);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        twoFactorEnabled,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        getProfile,
        updateProfile,
        changePassword,
        verifyTwoFactor,
        generate2FASecret,
        requestPasswordReset,
        resetPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

export default AuthContext;
