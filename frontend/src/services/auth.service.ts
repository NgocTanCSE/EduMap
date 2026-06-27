import { jwtDecode } from "jwt-decode";
import { UserRole } from '../types/auth-types';
import { fetchWithRetry } from '@/src/lib/fetch-with-retry';

export const ACCESS_TOKEN_KEY = 'edumap-access-token';
export const REFRESH_TOKEN_KEY = 'edumap-refresh-token';
export const USER_INFO_KEY = 'edumap-user-info';

interface DecodedToken {
  sub: string;
  email: string;
  role: UserRole;
  exp: number;
  iat: number;
}

export interface CurrentUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  avatar_url?: string;
  phone?: string;
  bio?: string;
}

class AuthService {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private currentUser: CurrentUser | null = null;

  constructor() {
    // Attempt to load tokens and user info from storage on instantiation
    if (typeof window !== 'undefined') {
      this.accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
      this.refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
      const userInfoString = localStorage.getItem(USER_INFO_KEY);
      if (userInfoString) {
        try {
          this.currentUser = JSON.parse(userInfoString);
        } catch (error) {
          console.error("Failed to parse user info from localStorage:", error);
          this.clearAuthData();
        }
      }
    }
  }

  // === Token Management ===
  setTokens(accessToken: string, refreshToken: string = accessToken) {
    if (typeof window !== 'undefined') {
      localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
      localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    }
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    this.updateCurrentUserFromAccessToken();
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  getRefreshToken(): string | null {
    return this.refreshToken;
  }


  setUserInfo(user: CurrentUser | null) {
    this.currentUser = user;
    if (typeof window !== 'undefined') {
      if (user) {
        localStorage.setItem(USER_INFO_KEY, JSON.stringify(user));
      } else {
        localStorage.removeItem(USER_INFO_KEY);
      }
    }
  }

  clearAuthData() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(ACCESS_TOKEN_KEY);
      localStorage.removeItem(REFRESH_TOKEN_KEY);
      localStorage.removeItem(USER_INFO_KEY);
    }
    this.accessToken = null;
    this.refreshToken = null;
    this.currentUser = null;
  }

  // === User Info & Status ===
  private parseJwt(token: string): DecodedToken | null {
    try {
      return jwtDecode<DecodedToken>(token);
    } catch (error) {
      console.error("Error decoding JWT:", error);
      return null;
    }
  }

  private updateCurrentUserFromAccessToken() {
    const token = this.getAccessToken();
    if (token) {
      const decoded = this.parseJwt(token);
      if (decoded) {
        // Here, we might not have fullName or avatar_url from the token itself
        // In a real app, these would come from the login response or a separate user profile API call
        // For now, we'll try to preserve existing or set empty
        this.currentUser = {
          id: decoded.sub,
          email: decoded.email,
          role: decoded.role,
          fullName: this.currentUser?.fullName || '', // Keep existing if available, else empty
          avatar_url: this.currentUser?.avatar_url || '' // Keep existing if available, else empty
        };
        if (typeof window !== 'undefined') {
          localStorage.setItem(USER_INFO_KEY, JSON.stringify(this.currentUser));
        }
      } else {
        this.clearAuthData(); // Invalid token
      }
    } else {
      this.currentUser = null;
      if (typeof window !== 'undefined') {
        localStorage.removeItem(USER_INFO_KEY);
      }
    }
  }

  getUser(): CurrentUser | null {
    // If currentUser is null, try to rebuild from token
    if (!this.currentUser && this.accessToken) {
      this.updateCurrentUserFromAccessToken();
    }
    return this.currentUser;
  }

  isLoggedIn(): boolean {
    const token = this.getAccessToken();
    if (!token) {
      return false;
    }
    const decoded = this.parseJwt(token);
    if (!decoded || !decoded.exp) {
      return false;
    }
    const currentTime = Date.now() / 1000; // in seconds
    return decoded.exp > currentTime;
  }

  isAdmin(): boolean {
    const user = this.getUser();
    return user?.role === UserRole.ADMIN || user?.role === UserRole.MODERATOR;
  }

  logout() {
    this.clearAuthData();
    // Redirect to login page or home
    if (typeof window !== 'undefined') {
      window.location.href = '/auth/login'; // Redirect to login page
    }
  }

  async updateProfile(updateData: { full_name?: string; phone?: string; bio?: string; avatar_url?: string; skills?: string[]; interests?: string[] }): Promise<any> {
    try {
      const response = await fetchWithRetry('/api/auth/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAccessToken()}`,
        },
        retries: 2,
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        throw new Error('Failed to update profile');
      }

      const data = await response.json();
      const updatedUser = data.data || data;
      
      if (updatedUser) {
        this.currentUser = {
          id: updatedUser.userId || this.currentUser?.id || '',
          email: updatedUser.email || this.currentUser?.email || '',
          fullName: updatedUser.full_name || this.currentUser?.fullName || '',
          role: updatedUser.role || this.currentUser?.role || UserRole.STUDENT,
          avatar_url: updatedUser.avatar_url || this.currentUser?.avatar_url || '',
        };
        if (typeof window !== 'undefined') {
          localStorage.setItem(USER_INFO_KEY, JSON.stringify(this.currentUser));
        }
      }

      return updatedUser;
    } catch (error) {
      console.error("Error updating profile:", error);
      throw error;
    }
  }

  async refreshAuthTokens(): Promise<boolean> {
    const refreshToken = this.getRefreshToken();
    const userId = this.getUser()?.id; // Assuming userId is available in the current user object
    
    if (!refreshToken || !userId) {
      this.logout(); // Can't refresh without tokens or user ID
      return false;
    }

    try {
      // Call backend refresh API
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken, userId }),
      });

      if (!response.ok) {
        console.error("Failed to refresh token:", response.status, response.statusText);
        this.logout(); // Logout if refresh fails
        return false;
      }
      const data = await response.json();
      const authData = data.data || data;
      this.setTokens(authData.access_token, authData.refresh_token || authData.access_token);
      return true;
    } catch (error) {
      console.error("Error refreshing tokens:", error);
      this.logout(); // Logout if refresh fails
      return false;
    }
  }
}

export const authService = new AuthService();
