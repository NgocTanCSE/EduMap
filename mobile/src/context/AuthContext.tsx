import React, { createContext, useState, useContext, useEffect } from 'react';
import { apiService } from '../services/api';

interface AuthContextType {
  user: any | null;
  isLoading: boolean;
  login: (credentials: any) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const login = async (credentials: any) => {
    setIsLoading(true);
    try {
      const response = await apiService.post('/auth/login', credentials);
      const authData = response.data || response;
      const { access_token } = authData;
      
      apiService.setToken(access_token);
      setUser({
        id: authData.userId,
        email: authData.email,
        fullName: authData.full_name,
        role: authData.role,
      });
    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    apiService.setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
