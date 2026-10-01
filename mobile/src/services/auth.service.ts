import apiService from './api';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const TOKEN_KEY = 'edumap_access_token';
const REFRESH_KEY = 'edumap_refresh_token';
const USER_KEY = 'edumap_user';

export interface AuthUser {
  id: string;
  email: string;
  fullName?: string;
  role?: string;
}

export const authService = {
  async login(email: string, password: string) {
    const res = await apiService.login({ email, password });
    // Backend returns the auth payload nested under `data`
    // ({ success, data: { access_token, refresh_token, userId, email, ... } }).
    const payload = res?.data || res;
    const access_token = payload?.access_token || res?.access_token;
    const refresh_token = payload?.refresh_token || res?.refresh_token;
    const user: AuthUser = {
      id: payload?.userId || res?.userId || res?.id,
      email: payload?.email || res?.email,
      fullName: payload?.full_name || res?.full_name,
      role: payload?.role || res?.role,
    };
    await this._store(access_token, refresh_token, user);
    apiService.setToken(access_token);
    return { user, access_token, refresh_token };
  },

  async register(payload: { email: string; password: string; full_name: string; phone?: string }) {
    return await apiService.register(payload);
  },

  async getProfile() {
    return await apiService.getProfile();
  },

  async updateProfile(data: any) {
    return await apiService.updateProfile(data);
  },

  async changePassword(old_password: string, new_password: string) {
    return await apiService.changePassword({ old_password, new_password });
  },

  async generate2FASecret() {
    return await apiService.generate2FASecret();
  },

  async verifyTwoFactor(userId: string, token: string) {
    return await apiService.verifyTwoFactor({ userId, token });
  },

  async forgotPassword(email: string) {
    return await apiService.forgotPassword(email);
  },

  async resetPassword(token: string, new_password: string) {
    return await apiService.resetPassword({ token, new_password });
  },

  async logout() {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_KEY);
    await SecureStore.deleteItemAsync(USER_KEY);
    apiService.setToken(null);
  },

  async loadStoredAuth(): Promise<{ token: string | null; user: AuthUser | null; refresh: string | null }> {
    try {
      const [token, refresh, userStr] = await Promise.all([
        SecureStore.getItemAsync(TOKEN_KEY),
        SecureStore.getItemAsync(REFRESH_KEY),
        SecureStore.getItemAsync(USER_KEY),
      ]);
      const user = userStr ? (JSON.parse(userStr) as AuthUser) : null;
      if (token) apiService.setToken(token);
      return { token, user, refresh };
    } catch (e) {
      // web fallback
      if (Platform.OS === 'web') {
        const token = typeof window !== 'undefined' ? window.localStorage.getItem(TOKEN_KEY) : null;
        if (token) apiService.setToken(token);
        return { token, user: null, refresh: null };
      }
      return { token: null, user: null, refresh: null };
    }
  },

  async _store(token: string | null, refresh: string | null, user: AuthUser) {
    try {
      if (token) {
        await SecureStore.setItemAsync(TOKEN_KEY, token);
        await apiService.setToken(token);
      }
      if (refresh) await SecureStore.setItemAsync(REFRESH_KEY, refresh);
      if (user) await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
    } catch (e) {
      // ignore
    }
  },
};

export default authService;
