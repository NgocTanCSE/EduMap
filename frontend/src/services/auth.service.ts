import { jwtDecode } from "jwt-decode";
import { UserRole } from '../types/auth-types';
import { fetchWithRetry } from '@/src/lib/fetch-with-retry';
import { unwrapApiResponse } from '@/src/lib/api-utils';
export const ACCESS_TOKEN_KEY = 'edumap-access-token';
export const REFRESH_TOKEN_KEY = 'edumap-refresh-token';
export const USER_INFO_KEY = 'edumap-user-info';
function sanitizeAvatarUrl(url?: string | null): string {
    const trimmed = (url || '').trim();
    if (!trimmed)
        return '';
    if (/^https?:\/\/(?:ui-avatars\.com|placehold\.co|via\.placeholder\.com)\//i.test(trimmed)) {
        return '';
    }
    return trimmed;
}
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
    date_of_birth?: string;
    major?: string;
}
class AuthService {
    private accessToken: string | null = null;
    private refreshToken: string | null = null;
    private currentUser: CurrentUser | null = null;
    constructor() {
        if (typeof window !== 'undefined') {
            this.accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
            this.refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
            if (this.accessToken && this.isDemoToken(this.accessToken)) {
                this.clearAuthData();
                return;
            }
            const userInfoString = localStorage.getItem(USER_INFO_KEY);
            if (userInfoString) {
                try {
                    this.currentUser = JSON.parse(userInfoString);
                    if (this.currentUser) {
                        this.currentUser.avatar_url = sanitizeAvatarUrl(this.currentUser.avatar_url);
                    }
                    if (this.currentUser?.id === 'demo-user' || this.isDemoToken(this.currentUser?.id || '')) {
                        this.clearAuthData();
                    }
                }
                catch (error) {
                    console.error("Failed to parse user info from localStorage:", error);
                    this.clearAuthData();
                }
            }
        }
    }
    setTokens(accessToken: string, refreshToken: string) {
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
    async fetchUserProfile(): Promise<CurrentUser | null> {
        const token = this.getAccessToken();
        if (!token)
            throw new Error('Vui lòng đăng nhập');
        try {
            const response = await fetchWithRetry('/api/auth/profile', {
                headers: { 'Authorization': `Bearer ${token}` },
            });
            if (!response.ok)
                throw new Error('Không thể tải hồ sơ người dùng');
            const data = await response.json();
            const profile = unwrapApiResponse<any>(data);
            const userInfo: CurrentUser = {
                id: profile.userId || profile.id,
                email: profile.email,
                fullName: profile.full_name || profile.fullName || '',
                role: profile.role || UserRole.STUDENT,
                avatar_url: sanitizeAvatarUrl(profile.avatar_url),
                phone: profile.phone || '',
                bio: profile.bio || '',
                date_of_birth: profile.date_of_birth || '',
                major: profile.major || '',
            };
            this.currentUser = userInfo;
            if (typeof window !== 'undefined') {
                localStorage.setItem(USER_INFO_KEY, JSON.stringify(userInfo));
            }
            return userInfo;
        }
        catch (error) {
            console.error("Error fetching user profile:", error);
            throw error;
        }
    }
    setUserInfo(user: CurrentUser | null) {
        this.currentUser = user;
        if (typeof window !== 'undefined') {
            if (user) {
                localStorage.setItem(USER_INFO_KEY, JSON.stringify(user));
            }
            else {
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
    private isDemoToken(token: string): boolean {
        if (!token)
            return false;
        return token.includes('signature') || token.includes('demo-user');
    }
    private parseJwt(token: string): DecodedToken | null {
        try {
            return jwtDecode<DecodedToken>(token);
        }
        catch (error) {
            console.error("Error decoding JWT:", error);
            return null;
        }
    }
    private updateCurrentUserFromAccessToken() {
        const token = this.getAccessToken();
        if (!token) {
            this.currentUser = null;
            if (typeof window !== 'undefined') {
                localStorage.removeItem(USER_INFO_KEY);
            }
            return;
        }
        if (this.isDemoToken(token)) {
            this.clearAuthData();
            return;
        }
        const decoded = this.parseJwt(token);
        if (!decoded) {
            this.clearAuthData();
            return;
        }
        if (!decoded.exp || Date.now() / 1000 >= decoded.exp) {
            this.clearAuthData();
            return;
        }
        this.currentUser = {
            id: decoded.sub,
            email: decoded.email,
            role: decoded.role,
            fullName: this.currentUser?.fullName || '',
            avatar_url: this.currentUser?.avatar_url || ''
        };
        if (typeof window !== 'undefined') {
            localStorage.setItem(USER_INFO_KEY, JSON.stringify(this.currentUser));
        }
    }
    getUser(): CurrentUser | null {
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
        if (this.isDemoToken(token)) {
            this.clearAuthData();
            return false;
        }
        const decoded = this.parseJwt(token);
        if (!decoded || !decoded.exp) {
            return false;
        }
        const currentTime = Date.now() / 1000;
        return decoded.exp > currentTime;
    }
    isAdmin(): boolean {
        const user = this.getUser();
        return user?.role === UserRole.ADMIN || user?.role === UserRole.MODERATOR;
    }
    logout() {
        this.clearAuthData();
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new Event('edumap-auth-logout'));
            window.location.href = '/auth/login';
        }
    }
    async devLogin(role?: string): Promise<CurrentUser> {
        const response = await fetchWithRetry('/api/auth/dev-login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(role ? { role } : {}),
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || 'Dev login failed.');
        }
        const authData = unwrapApiResponse<any>(data);
        this.setTokens(authData.access_token, authData.refresh_token);
        const userInfo: CurrentUser = {
            id: authData.userId || authData.id,
            email: authData.email,
            fullName: authData.full_name || authData.fullName || 'Dev User',
            role: (authData.role || UserRole.STUDENT) as UserRole,
            avatar_url: sanitizeAvatarUrl(authData.avatar_url),
            phone: authData.phone || '',
            bio: authData.bio || '',
            date_of_birth: authData.date_of_birth || '',
            major: authData.major || '',
        };
        this.setUserInfo(userInfo);
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new Event('edumap-auth-login'));
        }
        return userInfo;
    }
    async loginWithCredentials(email: string, password: string): Promise<any> {
        const response = await fetchWithRetry('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || 'Đăng nhập thất bại.');
        }
        const authData = unwrapApiResponse<any>(data);
        this.setTokens(authData.access_token, authData.refresh_token);
        const userInfo: CurrentUser = {
            id: authData.userId || authData.id,
            email: authData.email,
            fullName: authData.full_name || authData.fullName || 'Học sinh EduMap',
            role: (authData.role || UserRole.STUDENT) as UserRole,
            avatar_url: sanitizeAvatarUrl(authData.avatar_url),
            phone: authData.phone || '',
            bio: authData.bio || '',
            date_of_birth: authData.date_of_birth || '',
            major: authData.major || '',
        };
        this.setUserInfo(userInfo);
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new Event('edumap-auth-login'));
        }
        return userInfo;
    }
    async loginWithGoogle(googleData: {
        email: string;
        full_name?: string;
        avatar_url?: string;
        role?: UserRole;
        credential?: string;
    }): Promise<CurrentUser> {
        const response = await fetchWithRetry('/api/auth/google', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(googleData),
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || 'Đăng nhập Google thất bại.');
        }
        const authData = unwrapApiResponse<any>(data);
        this.setTokens(authData.access_token, authData.refresh_token);
        const userInfo: CurrentUser = {
            id: authData.userId || authData.id,
            email: authData.email,
            fullName: authData.full_name || authData.fullName || 'Người dùng Google',
            role: (authData.role || googleData.role || UserRole.STUDENT) as UserRole,
            avatar_url: sanitizeAvatarUrl(authData.avatar_url || googleData.avatar_url),
            phone: authData.phone || '',
            bio: authData.bio || '',
            date_of_birth: authData.date_of_birth || '',
            major: authData.major || '',
        };
        this.setUserInfo(userInfo);
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new Event('edumap-auth-login'));
        }
        return userInfo;
    }
    async updateProfile(updateData: {
        full_name?: string;
        phone?: string;
        bio?: string;
        avatar_url?: string;
        date_of_birth?: string;
        major?: string;
        skills?: string[];
        interests?: string[];
    }): Promise<any> {
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
            const updatedUser = unwrapApiResponse<any>(data);
            if (updatedUser) {
                this.currentUser = {
                    id: updatedUser.userId || this.currentUser?.id || '',
                    email: updatedUser.email || this.currentUser?.email || '',
                    fullName: updatedUser.full_name || this.currentUser?.fullName || '',
                    role: updatedUser.role || this.currentUser?.role || UserRole.STUDENT,
                    avatar_url: sanitizeAvatarUrl(updatedUser.avatar_url || this.currentUser?.avatar_url),
                    phone: updatedUser.phone || this.currentUser?.phone || '',
                    bio: updatedUser.bio || this.currentUser?.bio || '',
                    date_of_birth: updatedUser.date_of_birth || this.currentUser?.date_of_birth || '',
                    major: updatedUser.major || this.currentUser?.major || '',
                };
                if (typeof window !== 'undefined') {
                    localStorage.setItem(USER_INFO_KEY, JSON.stringify(this.currentUser));
                }
            }
            return updatedUser;
        }
        catch (error) {
            console.error("Error updating profile:", error);
            throw error;
        }
    }
    async refreshAuthTokens(): Promise<boolean> {
        const refreshToken = this.getRefreshToken();
        const userId = this.getUser()?.id;
        if (!refreshToken || !userId) {
            this.logout();
            return false;
        }
        try {
            const response = await fetchWithRetry('/api/auth/refresh', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshToken, userId }),
            });
            if (!response.ok) {
                console.error("Failed to refresh token:", response.status, response.statusText);
                this.logout();
                return false;
            }
            const data = await response.json();
            const authData = unwrapApiResponse<any>(data);
            this.setTokens(authData.access_token, authData.refresh_token);
            return true;
        }
        catch (error) {
            console.error("Error refreshing tokens:", error);
            this.logout();
            return false;
        }
    }
    async getPreferences(): Promise<any> {
        const token = this.getAccessToken();
        if (!token)
            throw new Error('Vui lòng đăng nhập');
        try {
            const response = await fetchWithRetry('/api/auth/preferences', {
                headers: { 'Authorization': `Bearer ${token}` },
            });
            if (!response.ok)
                throw new Error('Không thể tải cài đặt');
            const data = await response.json();
            return unwrapApiResponse<any>(data);
        }
        catch (error) {
            console.error("Error fetching preferences:", error);
            throw error;
        }
    }
    async updatePreferences(prefs: {
        language?: string;
        theme?: string;
        notifications_enabled?: boolean;
        privacy_level?: string;
        notification_settings?: string;
    }): Promise<any> {
        const token = this.getAccessToken();
        if (!token)
            throw new Error('Vui lòng đăng nhập');
        try {
            const response = await fetchWithRetry('/api/auth/preferences', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                retries: 2,
                body: JSON.stringify(prefs),
            });
            if (!response.ok) {
                throw new Error('Failed to update preferences');
            }
            const data = await response.json();
            return unwrapApiResponse<any>(data);
        }
        catch (error) {
            console.error("Error updating preferences:", error);
            throw error;
        }
    }

    async forgotPassword(email: string) {
        const response = await fetchWithRetry('/api/auth/forgot-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
        });
        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.message || 'Không thể gửi yêu cầu đặt lại mật khẩu');
        }
        return unwrapApiResponse<any>(await response.json());
    }

    async resetPassword(token: string, newPassword: string) {
        const response = await fetchWithRetry('/api/auth/reset-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, newPassword }),
        });
        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.message || 'Đặt lại mật khẩu thất bại');
        }
        return unwrapApiResponse<any>(await response.json());
    }

    async changePassword(currentPassword: string, newPassword: string) {
        const token = this.getAccessToken();
        if (!token)
            throw new Error('Vui lòng đăng nhập để đổi mật khẩu');
        const response = await fetchWithRetry('/api/auth/change-password', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({ currentPassword, newPassword }),
        });
        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.message || 'Đổi mật khẩu thất bại');
        }
        return unwrapApiResponse<any>(await response.json());
    }
}
export const authService = new AuthService();
