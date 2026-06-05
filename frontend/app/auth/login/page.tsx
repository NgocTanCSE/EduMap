"use client";
import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation'; // Correct import for useRouter
import { LogIn, Mail, Lock, Eye, EyeOff, Github, Chrome, ShieldCheck } from 'lucide-react'; // Added ShieldCheck for 2FA
import { authService } from '@/src/services/auth.service'; // Adjust path as needed

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [twoFactorToken, setTwoFactorToken] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [requiresTwoFactorAuth, setRequiresTwoFactorAuth] = useState(false);
  const [userIdFor2FA, setUserIdFor2FA] = useState('');

  const router = useRouter();

  const validateForm = () => {
    if (!email) {
      setErrorMessage('Email không được để trống.');
      return false;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      setErrorMessage('Email không hợp lệ.');
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) {
      return;
    }

    try {
      const response = await fetch('/api/auth/login', { // Assuming /api/auth/login is the correct endpoint
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setErrorMessage(data.message || 'Đăng nhập thất bại. Vui lòng thử lại.');
        return;
      }

      if (data.requiresTwoFactorAuth) {
        setRequiresTwoFactorAuth(true);
        setUserIdFor2FA(data.userId);
        setErrorMessage('');
      } else {
        authService.setTokens(data.access_token, data.refresh_token);
        // Assuming the login response also contains user info (id, email, fullName, role)
        // You might need to adjust this based on actual backend response
        authService.getUser(); // Force update current user
        router.push('/dashboard'); // Redirect to dashboard or home page
      }
    } catch (error) {
      console.error('Lỗi khi đăng nhập:', error);
      setErrorMessage('Đã xảy ra lỗi. Vui lòng thử lại sau.');
    }
  };

  const handleTwoFactorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!twoFactorToken) {
      setErrorMessage('Mã 2FA không được để trống.');
      return;
    }

    try {
      const response = await fetch('/api/auth/2fa/verify', { // Assuming /api/auth/2fa/verify is the correct endpoint
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userIdFor2FA, token: twoFactorToken }),
      });

      const data = await response.json();

      if (!response.ok) {
        setErrorMessage(data.message || 'Xác minh 2FA thất bại. Vui lòng thử lại.');
        return;
      }

      authService.setTokens(data.access_token, data.refresh_token);
      authService.getUser(); // Force update current user
      router.push('/dashboard'); // Redirect to dashboard or home page
    } catch (error) {
      console.error('Lỗi khi xác minh 2FA:', error);
      setErrorMessage('Đã xảy ra lỗi khi xác minh 2FA. Vui lòng thử lại sau.');
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#0a0a0a] relative overflow-hidden">
      {/* Background Decorative Elements Removed */}

      {/* Login Card */}
      <div className="w-full max-w-md p-8 relative z-10">
        <div className="bg-card border border-white/10 rounded-3xl p-8 shadow-2xl">
          <div className="text-center mb-10">
            <div className="w-16 h-16 bg-yellow-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-yellow-600/30">
              {requiresTwoFactorAuth ? <ShieldCheck className="text-white w-8 h-8" /> : <LogIn className="text-white w-8 h-8" />}
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">
              {requiresTwoFactorAuth ? 'Xác thực 2 yếu tố' : 'Chào mừng trở lại'}
            </h1>
            <p className="text-gray-400">
              {requiresTwoFactorAuth ? 'Vui lòng nhập mã 2FA từ ứng dụng xác thực của bạn.' : 'Đăng nhập để tiếp tục hành trình học tập'}
            </p>
          </div>

          {errorMessage && (
            <div className="bg-red-500/20 text-red-400 p-3 rounded-xl mb-6 text-center text-sm">
              {errorMessage}
            </div>
          )}

          {!requiresTwoFactorAuth ? (
            <form className="space-y-6" onSubmit={handleSubmit}>
              {/* Email Field */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300 ml-1">Email của bạn</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input 
                    type="email" 
                    placeholder="name@example.com"
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-600/50 transition-all placeholder:text-gray-600"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-2">
                <div className="flex justify-between items-center ml-1">
                  <label className="text-sm font-medium text-gray-300">Mật khẩu</label>
                  <Link href="/auth/forgot-password" className="text-xs text-yellow-500 hover:underline">Quên mật khẩu?</Link> {/* Link to forgot password page */}
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input 
                    type={showPassword ? "text" : "password"} 
                    placeholder="••••••••"
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl py-3 pl-11 pr-11 text-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-600/50 transition-all placeholder:text-gray-600"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button 
                type="submit"
                className="w-full bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-yellow-600/25 active:scale-[0.98]"
              >
                Đăng nhập ngay
              </button>
            </form>
          ) : (
            <form className="space-y-6" onSubmit={handleTwoFactorSubmit}>
              {/* 2FA Token Field */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300 ml-1">Mã 2FA của bạn</label>
                <div className="relative">
                  <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input 
                    type="text" 
                    placeholder="123456"
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-600/50 transition-all placeholder:text-gray-600"
                    value={twoFactorToken}
                    onChange={(e) => setTwoFactorToken(e.target.value)}
                  />
                </div>
              </div>
              {/* Submit 2FA Button */}
              <button 
                type="submit"
                className="w-full bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-yellow-600/25 active:scale-[0.98]"
              >
                Xác minh 2FA
              </button>
              <button 
                type="button"
                onClick={() => { setRequiresTwoFactorAuth(false); setErrorMessage(''); }}
                className="w-full mt-4 text-sm text-gray-400 hover:text-gray-200"
              >
                Quay lại
              </button>
            </form>
          )}

          {/* Social Logins (only if not requiring 2FA) */}
          {!requiresTwoFactorAuth && (
            <div className="mt-8">
              <div className="relative mb-6">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10"></div></div>
                <div className="relative flex justify-center text-xs uppercase"><span className="bg-transparent px-2 text-gray-500">Hoặc tiếp tục với</span></div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button className="flex items-center justify-center gap-2 bg-card border border-white/10 rounded-xl py-2.5 text-white hover:bg-card transition-all">
                  <Chrome className="w-5 h-5" />
                  <span className="text-sm font-medium">Google</span>
                </button>
                <button className="flex items-center justify-center gap-2 bg-card border border-white/10 rounded-xl py-2.5 text-white hover:bg-card transition-all">
                  <Github className="w-5 h-5" />
                  <span className="text-sm font-medium">Github</span>
                </button>
              </div>
            </div>
          )}

          {!requiresTwoFactorAuth && (
            <p className="text-center mt-10 text-gray-400 text-sm">
              Chưa có tài khoản?{' '}
              <Link href="/auth/register" className="text-yellow-500 font-bold hover:underline">Đăng ký ngay</Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
