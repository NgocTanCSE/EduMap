"use client";
import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { LogIn, Mail, Lock, Eye, EyeOff, ShieldCheck, Loader2, Sparkles, UserCheck } from 'lucide-react';
import { authService } from '@/src/services/auth.service';

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get('redirect') || '/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [twoFactorToken, setTwoFactorToken] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [quickLoginLoading, setQuickLoginLoading] = useState(false);
  const [requiresTwoFactorAuth, setRequiresTwoFactorAuth] = useState(false);
  const [userIdFor2FA, setUserIdFor2FA] = useState('');
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (authService.isLoggedIn()) {
      router.replace(redirectUrl);
    } else {
      setChecking(false);
    }
  }, [router, redirectUrl]);

  if (checking) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[#0a0a0a]">
        <div className="flex items-center gap-3 text-white/70">
          <Loader2 className="w-6 h-6 animate-spin text-yellow-500" />
          <span>Đang kiểm tra trạng thái đăng nhập...</span>
        </div>
      </div>
    );
  }

  const validateForm = () => {
    if (!email) {
      setErrorMessage('Email không được để trống.');
      return false;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      setErrorMessage('Email không đúng định dạng.');
      return false;
    }
    if (!password) {
      setErrorMessage('Mật khẩu không được để trống.');
      return false;
    }
    if (password.length < 6) {
      setErrorMessage('Mật khẩu phải có ít nhất 6 ký tự.');
      return false;
    }
    setErrorMessage('');
    return true;
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    setErrorMessage('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setErrorMessage(data.message || 'Email hoặc mật khẩu không chính xác.');
        return;
      }

      if (data.requiresTwoFactorAuth) {
        setRequiresTwoFactorAuth(true);
        setUserIdFor2FA(data.userId);
        setErrorMessage('');
      } else {
        const authData = data.data || data;
        authService.setTokens(authData.access_token, authData.refresh_token || authData.access_token);
        authService.setUserInfo({
          id: authData.userId || authData.id,
          email: authData.email,
          fullName: authData.full_name || authData.fullName || 'Người dùng',
          role: authData.role,
          avatar_url: authData.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(authData.full_name || 'U')}&background=random`,
        } as any);

        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('edumap-auth-login'));
        }

        router.replace(redirectUrl);
      }
    } catch (error: any) {
      console.error('Lỗi khi đăng nhập:', error);
      setErrorMessage(error.message || 'Đã xảy ra lỗi kết nối. Vui lòng thử lại sau.');
    } finally {
      setLoading(false);
    }
  };

  // Quick 1-click login as normal STUDENT / USER (Trần Hoàng Yến - student3@edumap.vn)
  const handleQuickStudentLogin = async () => {
    setQuickLoginLoading(true);
    setErrorMessage('');
    try {
      await authService.loginWithCredentials('student3@edumap.vn', 'password123');
      router.replace(redirectUrl);
    } catch (error: any) {
      setErrorMessage(error.message || 'Không thể đăng nhập tài khoản học sinh mẫu.');
    } finally {
      setQuickLoginLoading(false);
    }
  };

  const handleTwoFactorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!twoFactorToken) {
      setErrorMessage('Mã 2FA không được để trống.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/auth/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userIdFor2FA, token: twoFactorToken }),
      });

      const data = await response.json();
      if (!response.ok) {
        setErrorMessage(data.message || 'Xác minh 2FA thất bại. Vui lòng thử lại.');
        return;
      }

      const authData = data.data || data;
      authService.setTokens(authData.access_token, authData.refresh_token || authData.access_token);
      authService.setUserInfo({
        id: authData.userId || authData.id,
        email: authData.email,
        fullName: authData.full_name || authData.fullName || 'Người dùng',
        role: authData.role,
        avatar_url: authData.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(authData.full_name || 'U')}&background=random`,
      } as any);

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('edumap-auth-login'));
      }

      router.replace(redirectUrl);
    } catch (error: any) {
      setErrorMessage(error.message || 'Đã xảy ra lỗi khi xác minh 2FA.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#0a0a0a] px-4 py-12 relative overflow-hidden">
      <div className="w-full max-w-md relative z-10">
        <div className="bg-[#121215] border border-white/10 rounded-3xl p-8 shadow-2xl backdrop-blur-xl">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-tr from-yellow-600 to-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-yellow-600/30">
              {requiresTwoFactorAuth ? <ShieldCheck className="text-white w-8 h-8" /> : <LogIn className="text-white w-8 h-8" />}
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">
              {requiresTwoFactorAuth ? 'Xác thực 2 yếu tố' : 'Đăng nhập EduMap'}
            </h1>
            <p className="text-sm text-gray-400">
              {requiresTwoFactorAuth
                ? 'Nhập mã 2FA từ ứng dụng xác thực'
                : 'Đăng nhập để sử dụng đầy đủ các tính năng giáo dục'}
            </p>
          </div>

          {/* Quick Login As Regular User Button */}
          {!requiresTwoFactorAuth && (
            <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-yellow-500/10 via-amber-500/10 to-yellow-500/5 border border-yellow-500/20">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-yellow-400" />
                <span className="text-xs font-bold text-yellow-400 uppercase tracking-wider">
                  Trải nghiệm nhanh cho Người Dùng
                </span>
              </div>
              <p className="text-xs text-zinc-300 mb-3">
                Đăng nhập 1-chạm với tài khoản <b>Học sinh (Student)</b> có sẵn dữ liệu thật trong hệ thống:
              </p>
              <button
                type="button"
                onClick={handleQuickStudentLogin}
                disabled={quickLoginLoading || loading}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-400 hover:to-amber-500 text-black font-bold py-2.5 px-4 rounded-xl text-sm transition-all shadow-md shadow-yellow-500/20 active:scale-[0.98] disabled:opacity-50"
              >
                {quickLoginLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-black" />
                    <span>Đang đăng nhập tài khoản học sinh...</span>
                  </>
                ) : (
                  <>
                    <UserCheck className="w-4 h-4 text-black" />
                    <span>Đăng nhập nhanh với quyền Học sinh (User)</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Error Message */}
          {errorMessage && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-xl mb-6 text-center text-xs font-medium">
              {errorMessage}
            </div>
          )}

          {!requiresTwoFactorAuth ? (
            <form className="space-y-4" onSubmit={handleLoginSubmit}>
              <div className="relative mb-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/10"></div>
                </div>
                <div className="relative flex justify-center text-[11px] uppercase">
                  <span className="bg-[#121215] px-3 text-zinc-500 font-medium">Hoặc đăng nhập bằng email</span>
                </div>
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-300 ml-1">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="email"
                    placeholder="email@edumap.vn"
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-yellow-500 transition-all placeholder:text-gray-600"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center ml-1">
                  <label className="text-xs font-semibold text-gray-300">Mật khẩu</label>
                  <Link href="/auth/forgot-password" className="text-xs text-yellow-500 hover:underline">
                    Quên mật khẩu?
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl py-2.5 pl-10 pr-10 text-sm text-white focus:outline-none focus:border-yellow-500 transition-all placeholder:text-gray-600"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading || quickLoginLoading}
                className="w-full mt-2 bg-zinc-800 hover:bg-zinc-700 border border-white/10 text-white font-bold py-3 rounded-xl transition-all shadow-md active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Đang xác thực...</span>
                  </>
                ) : (
                  <span>Đăng nhập</span>
                )}
              </button>
            </form>
          ) : (
            <form className="space-y-4" onSubmit={handleTwoFactorSubmit}>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-300 ml-1">Mã xác thực 2FA</label>
                <div className="relative">
                  <ShieldCheck className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="123456"
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-yellow-500 transition-all"
                    value={twoFactorToken}
                    onChange={(e) => setTwoFactorToken(e.target.value)}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-yellow-600 hover:bg-yellow-500 text-black font-bold py-3 rounded-xl transition-all shadow-lg shadow-yellow-600/25 active:scale-[0.98] disabled:opacity-50"
              >
                {loading ? 'Đang xác minh...' : 'Xác minh 2FA'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setRequiresTwoFactorAuth(false);
                  setErrorMessage('');
                }}
                className="w-full text-xs text-gray-400 hover:text-white transition-colors text-center mt-2"
              >
                Quay lại
              </button>
            </form>
          )}

          {/* Footer Link */}
          <div className="text-center mt-8 text-xs text-gray-400">
            Chưa có tài khoản?{' '}
            <Link href="/auth/register" className="text-yellow-500 font-bold hover:underline">
              Đăng ký ngay
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen w-full flex items-center justify-center bg-[#0a0a0a]">
          <div className="flex items-center gap-3 text-white/70">
            <Loader2 className="w-6 h-6 animate-spin text-yellow-500" />
            <span>Đang tải...</span>
          </div>
        </div>
      }
    >
      <LoginFormContent />
    </Suspense>
  );
}
