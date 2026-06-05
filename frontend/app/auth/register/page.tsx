"use client";
import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { UserPlus, User, GraduationCap, Briefcase, Heart, Shield, Users, Mail, Lock, CheckCircle2 } from 'lucide-react';
import { authService } from '@/src/services/auth.service'; // Adjust path as needed
import { UserRole } from '@/src/types/auth-types'; // Import UserRole from shared types

const ROLES = [
  { id: UserRole.STUDENT, label: 'Học sinh / Sinh viên', icon: GraduationCap },
  { id: UserRole.PARENT, label: 'Phụ huynh', icon: Users },
  { id: UserRole.TEACHER, label: 'Giảng viên', icon: User },
  { id: UserRole.MENTOR, label: 'Chuyên gia tư vấn', icon: Briefcase },
  { id: UserRole.SCHOOL_REP, label: 'Đại diện trường', icon: Shield },
  { id: UserRole.DONOR, label: 'Mạnh thường quân', icon: Heart },
  { id: UserRole.EMPLOYER, label: 'Đơn vị tuyển dụng', icon: Briefcase },
  { id: UserRole.ADMIN, label: 'Quản trị viên', icon: Shield },
  { id: UserRole.COMMUNITY_COORD, label: 'Điều phối viên', icon: Users },
  { id: UserRole.SUPPORT_STAFF, label: 'Nhân viên hỗ trợ', icon: User },
  { id: UserRole.PARTNER, label: 'Đối tác chiến lược', icon: Briefcase },
  { id: UserRole.GUEST, label: 'Khách vãng lai', icon: User },
];

export default function RegisterPage() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>(UserRole.STUDENT);
  const [errorMessage, setErrorMessage] = useState('');

  const router = useRouter();

  const validateForm = () => {
    if (!fullName) {
      setErrorMessage('Họ và tên không được để trống.');
      return false;
    }
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
    if (password !== confirmPassword) {
      setErrorMessage('Mật khẩu xác nhận không khớp.');
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
      const response = await fetch('/api/auth/register', { // Assuming /api/auth/register is the correct endpoint
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          full_name: fullName, 
          email, 
          password, 
          role: selectedRole 
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setErrorMessage(data.message || 'Đăng ký thất bại. Vui lòng thử lại.');
        return;
      }

      // Assuming backend returns tokens upon successful registration
      authService.setTokens(data.access_token, data.refresh_token);
      authService.getUser(); // Force update current user
      router.push('/dashboard'); // Redirect to dashboard or home page
    } catch (error) {
      console.error('Lỗi khi đăng ký:', error);
      setErrorMessage('Đã xảy ra lỗi. Vui lòng thử lại sau.');
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#0a0a0a] py-12 px-4 relative overflow-hidden">
      <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/20 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-yellow-600/20 rounded-full blur-[120px] animate-pulse" />

      <div className="w-full max-w-2xl relative z-10">
        <div className="bg-card border border-white/10 rounded-3xl p-8 shadow-2xl">
          <div className="text-center mb-10">
            <div className="w-16 h-16 bg-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-purple-600/30">
              <UserPlus className="text-white w-8 h-8" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Tạo tài khoản mới</h1>
            <p className="text-gray-400">Tham gia hệ sinh thái giáo dục thông minh EduMap</p>
          </div>

          {errorMessage && (
            <div className="bg-red-500/20 text-red-400 p-3 rounded-xl mb-6 text-center text-sm">
              {errorMessage}
            </div>
          )}

          <form className="space-y-8" onSubmit={handleSubmit}>
            {/* Role Selection Grid */}
            <div className="space-y-4">
              <label className="text-sm font-medium text-gray-300 ml-1">Chọn vai trò của bạn</label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {ROLES.map((role) => (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => setSelectedRole(role.id)}
                    className={`p-3 rounded-xl border transition-all flex flex-col items-center gap-2 relative ${
                      selectedRole === role.id 
                      ? 'bg-purple-600/20 border-purple-600 ring-1 ring-purple-600' 
                      : 'bg-card border-white/10 hover:bg-card'
                    }`}
                  >
                    <role.icon className={`w-6 h-6 ${selectedRole === role.id ? 'text-purple-400' : 'text-gray-500'}`} />
                    <span className={`text-[10px] font-medium text-center ${selectedRole === role.id ? 'text-white' : 'text-gray-400'}`}>
                      {role.label}
                    </span>
                    {selectedRole === role.id && (
                      <CheckCircle2 className="absolute top-1 right-1 w-3 h-3 text-purple-400" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Account Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300 ml-1">Họ và tên</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input 
                    type="text" 
                    placeholder="Nguyễn Văn A" 
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-yellow-500 focus:outline-none focus:ring-2 focus:ring-purple-600/50" 
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300 ml-1">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input 
                    type="email" 
                    placeholder="name@example.com" 
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-yellow-500 focus:outline-none focus:ring-2 focus:ring-purple-600/50" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300 ml-1">Mật khẩu</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input 
                    type="password" 
                    placeholder="••••••••" 
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-yellow-500 focus:outline-none focus:ring-2 focus:ring-purple-600/50" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300 ml-1">Xác nhận mật khẩu</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input 
                    type="password" 
                    placeholder="••••••••" 
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-yellow-500 focus:outline-none focus:ring-2 focus:ring-purple-600/50" 
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <button type="submit" className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-purple-600/25 active:scale-[0.98]">
              Đăng ký tài khoản
            </button>
          </form>

          <p className="text-center mt-8 text-gray-400 text-sm">
            Đã có tài khoản?{' '}
            <Link href="/auth/login" className="text-purple-500 font-bold hover:underline">Đăng nhập ngay</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
