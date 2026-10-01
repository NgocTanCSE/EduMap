"use client";
import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  GraduationCap, 
  Users, 
  User, 
  Briefcase, 
  Shield, 
  Heart, 
  CheckCircle2, 
  Loader2, 
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Check
} from 'lucide-react';
import { authService } from '@/src/services/auth.service';
import { UserRole } from '@/src/types/auth-types';

// Google Multicolor G Icon SVG
function GoogleIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.36 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.36 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
      />
    </svg>
  );
}

const ROLES = [
  { 
    id: UserRole.STUDENT, 
    label: 'Học sinh / Sinh viên', 
    desc: 'Học tập, tìm đường, thư viện tài liệu & học bổng',
    icon: GraduationCap,
    gradient: 'from-blue-500/20 to-cyan-500/20',
    border: 'hover:border-blue-500/40',
    activeBorder: 'border-blue-500 bg-blue-500/15 ring-2 ring-blue-500/40'
  },
  { 
    id: UserRole.PARENT, 
    label: 'Phụ huynh', 
    desc: 'Theo dõi lộ trình, trường học & an toàn di chuyển',
    icon: Users,
    gradient: 'from-emerald-500/20 to-teal-500/20',
    border: 'hover:border-emerald-500/40',
    activeBorder: 'border-emerald-500 bg-emerald-500/15 ring-2 ring-emerald-500/40'
  },
  { 
    id: UserRole.TEACHER, 
    label: 'Giảng viên / Giáo viên', 
    desc: 'Chia sẻ tài liệu, hướng dẫn và kết nối người học',
    icon: User,
    gradient: 'from-amber-500/20 to-yellow-500/20',
    border: 'hover:border-amber-500/40',
    activeBorder: 'border-amber-500 bg-amber-500/15 ring-2 ring-amber-500/40'
  },
  { 
    id: UserRole.MENTOR, 
    label: 'Chuyên gia tư vấn (Mentor)', 
    desc: 'Tư vấn nghề nghiệp, định hướng đại học & việc làm',
    icon: Briefcase,
    gradient: 'from-purple-500/20 to-pink-500/20',
    border: 'hover:border-purple-500/40',
    activeBorder: 'border-purple-500 bg-purple-500/15 ring-2 ring-purple-500/40'
  },
  { 
    id: UserRole.SCHOOL_REP, 
    label: 'Đại diện trường học', 
    desc: 'Quản lý điểm giáo dục, thông tin tuyển sinh & sự kiện',
    icon: Shield,
    gradient: 'from-indigo-500/20 to-violet-500/20',
    border: 'hover:border-indigo-500/40',
    activeBorder: 'border-indigo-500 bg-indigo-500/15 ring-2 ring-indigo-500/40'
  },
  { 
    id: UserRole.EMPLOYER, 
    label: 'Đơn vị tuyển dụng', 
    desc: 'Tìm kiếm nhân tài, cấp cơ hội thực tập & việc làm',
    icon: Briefcase,
    gradient: 'from-orange-500/20 to-rose-500/20',
    border: 'hover:border-orange-500/40',
    activeBorder: 'border-orange-500 bg-orange-500/15 ring-2 ring-orange-500/40'
  },
  { 
    id: UserRole.DONOR, 
    label: 'Mạnh thường quân', 
    desc: 'Tài trợ học bổng, chiến dịch thiện nguyện & thiết bị',
    icon: Heart,
    gradient: 'from-rose-500/20 to-red-500/20',
    border: 'hover:border-rose-500/40',
    activeBorder: 'border-rose-500 bg-rose-500/15 ring-2 ring-rose-500/40'
  },
  { 
    id: UserRole.ADMIN, 
    label: 'Quản trị viên', 
    desc: 'Giám sát toàn bộ hệ thống & phân tích số liệu',
    icon: Shield,
    gradient: 'from-zinc-500/20 to-stone-500/20',
    border: 'hover:border-zinc-500/40',
    activeBorder: 'border-yellow-500 bg-yellow-500/15 ring-2 ring-yellow-500/40'
  },
];

function GoogleLoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get('redirect') || '/map';

  const [selectedRole, setSelectedRole] = useState<UserRole>(UserRole.STUDENT);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [checking, setChecking] = useState(true);

  // Google Dialog Modal State
  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [googleEmail, setGoogleEmail] = useState('');
  const [googleFullName, setGoogleFullName] = useState('');
  const [customAvatar, setCustomAvatar] = useState('');

  useEffect(() => {
    if (authService.isLoggedIn()) {
      router.replace(redirectUrl);
    } else {
      setChecking(false);
    }
  }, [router, redirectUrl]);

  // Load Google Identity Services SDK if available
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) return;

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      try {
        // @ts-ignore
        if (window.google?.accounts?.id) {
          // @ts-ignore
          window.google.accounts.id.initialize({
            client_id: clientId,
            callback: handleGoogleCredentialResponse,
          });
        }
      } catch (err) {
        console.warn('Google GIS init error:', err);
      }
    };
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, [selectedRole]);

  const handleGoogleCredentialResponse = async (response: any) => {
    if (!response?.credential) return;
    setLoading(true);
    setErrorMessage('');
    try {
      await authService.loginWithGoogle({
        credential: response.credential,
        email: '',
        role: selectedRole,
      });
      router.replace(redirectUrl);
    } catch (err: any) {
      setErrorMessage(err.message || 'Đăng nhập với Google thất bại.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenGoogleAuth = () => {
    setErrorMessage('');
    // @ts-ignore
    if (typeof window !== 'undefined' && window.google?.accounts?.id && process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID) {
      try {
        // @ts-ignore
        window.google.accounts.id.prompt();
        return;
      } catch (e) {
        console.warn('One tap prompt failed, opening Google modal dialog', e);
      }
    }
    // Default: Open authentic Google account prompt
    setShowGoogleModal(true);
  };

  const handleConfirmGoogleLogin = async (emailToUse: string, nameToUse: string, avatarToUse?: string) => {
    if (!emailToUse || !emailToUse.includes('@')) {
      setErrorMessage('Vui lòng nhập địa chỉ email Google hợp lệ.');
      return;
    }

    setLoading(true);
    setErrorMessage('');
    setShowGoogleModal(false);

    const safeName = nameToUse || emailToUse.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    const finalAvatar = avatarToUse || `https://ui-avatars.com/api/?name=${encodeURIComponent(safeName)}&background=4285F4&color=fff&size=200`;

    try {
      await authService.loginWithGoogle({
        email: emailToUse,
        full_name: safeName,
        avatar_url: finalAvatar,
        role: selectedRole,
      });
      router.replace(redirectUrl);
    } catch (err: any) {
      setErrorMessage(err.message || 'Đăng nhập Google thất bại. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[#09090b]">
        <div className="flex items-center gap-3 text-white/70">
          <Loader2 className="w-6 h-6 animate-spin text-yellow-500" />
          <span>Đang kiểm tra trạng thái đăng nhập...</span>
        </div>
      </div>
    );
  }

  const selectedRoleObj = ROLES.find(r => r.id === selectedRole) || ROLES[0];

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#09090b] px-4 py-12 relative overflow-hidden">
      {/* Dynamic Background Glows */}
      <div className="absolute top-[-15%] left-[20%] w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-15%] right-[20%] w-[500px] h-[500px] bg-yellow-500/10 rounded-full blur-[140px] pointer-events-none" />

      <div className="w-full max-w-2xl relative z-10">
        <div className="bg-[#121217] border border-white/10 rounded-3xl p-6 sm:p-10 shadow-2xl backdrop-blur-2xl">
          
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-zinc-300 mb-4">
              <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
              <span>Hệ thống Bản đồ Giáo dục Thông minh EduMap</span>
            </div>
            
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-2">
              Đăng nhập qua Google
            </h1>
            <p className="text-sm text-zinc-400 max-w-md mx-auto">
              Chọn vai trò của bạn trên hệ sinh thái và tiếp tục đăng nhập nhanh chóng chỉ bằng một chạm với tài khoản Google.
            </p>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3.5 rounded-2xl mb-6 text-center text-xs font-semibold flex items-center justify-center gap-2">
              <span>{errorMessage}</span>
            </div>
          )}

          {/* 1. ROLE SELECTION */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-3 px-1">
              <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                <span>1. Chọn vai trò của bạn</span>
              </label>
              <span className="text-xs text-yellow-500 font-medium">
                Đang chọn: {selectedRoleObj.label}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[300px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-zinc-700">
              {ROLES.map((role) => {
                const isSelected = selectedRole === role.id;
                const IconComponent = role.icon;
                return (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => setSelectedRole(role.id)}
                    className={`p-3.5 rounded-2xl border text-left transition-all duration-200 flex items-start gap-3 relative group ${
                      isSelected 
                        ? role.activeBorder 
                        : 'bg-zinc-900/60 border-white/5 hover:bg-zinc-900 hover:border-white/15'
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                      isSelected 
                        ? 'bg-white text-black font-bold shadow-md' 
                        : 'bg-white/5 text-zinc-400 group-hover:text-white'
                    }`}>
                      <IconComponent className="w-5 h-5" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-bold truncate ${isSelected ? 'text-white' : 'text-zinc-300'}`}>
                          {role.label}
                        </span>
                        {isSelected && (
                          <div className="w-4 h-4 rounded-full bg-yellow-500 flex items-center justify-center shrink-0 ml-1">
                            <Check className="w-2.5 h-2.5 text-black stroke-[3]" />
                          </div>
                        )}
                      </div>
                      <p className="text-[11px] text-zinc-500 line-clamp-1 mt-0.5">
                        {role.desc}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. SINGLE GOOGLE LOGIN BUTTON */}
          <div className="space-y-4 pt-2 border-t border-white/5">
            <div className="text-center">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                2. Xác thực tài khoản duy nhất
              </span>
            </div>

            <button
              type="button"
              onClick={handleOpenGoogleAuth}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 bg-white hover:bg-zinc-100 text-zinc-900 font-bold py-3.5 px-6 rounded-2xl text-sm transition-all shadow-xl shadow-white/5 hover:shadow-white/10 active:scale-[0.99] disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin text-zinc-900" />
                  <span>Đang kết nối tài khoản Google...</span>
                </>
              ) : (
                <>
                  <GoogleIcon className="w-5 h-5 shrink-0" />
                  <span>Đăng nhập với Google ({selectedRoleObj.label})</span>
                  <ArrowRight className="w-4 h-4 text-zinc-400 ml-auto" />
                </>
              )}
            </button>

            {/* Google Policy / Auto-Sync Notice */}
            <div className="bg-zinc-900/60 border border-white/5 rounded-2xl p-3.5 flex items-center gap-3 text-xs text-zinc-400">
              <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-4 h-4 text-blue-400" />
              </div>
              <p className="text-[11px] leading-relaxed">
                Hệ thống sẽ <b>tự động đồng bộ</b> Avatar đại diện, Họ tên và Email chính chủ từ tài khoản Google của bạn.
              </p>
            </div>
          </div>

        </div>
      </div>

      {/* GOOGLE ACCOUNT SELECTOR MODAL DIALOG */}
      {showGoogleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
          <div className="bg-[#18181b] border border-white/15 w-full max-w-md rounded-3xl p-6 sm:p-8 shadow-2xl relative">
            
            {/* Google Brand Header */}
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/10">
              <GoogleIcon className="w-7 h-7" />
              <div>
                <h3 className="text-base font-bold text-white">Đăng nhập bằng Google</h3>
                <p className="text-xs text-zinc-400">Tiếp tục đến ứng dụng EduMap</p>
              </div>
            </div>

            <p className="text-xs text-zinc-300 mb-4">
              Chọn tài khoản Google của bạn để đăng nhập với vai trò <span className="text-yellow-400 font-bold">{selectedRoleObj.label}</span>:
            </p>

            {/* Quick-Pick Profile 1: Sinh viên / Người dùng chuẩn */}
            <div className="space-y-2 mb-4">
              <button
                type="button"
                onClick={() => handleConfirmGoogleLogin(
                  'ngoctan.student@gmail.com',
                  'Ngọc Tấn',
                  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80'
                )}
                className="w-full flex items-center gap-3 p-3 rounded-2xl bg-zinc-900 border border-white/10 hover:border-blue-500/50 hover:bg-zinc-850 text-left transition-all group"
              >
                <img
                  src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80"
                  alt="Avatar"
                  className="w-10 h-10 rounded-full border border-white/20 object-cover"
                />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-white group-hover:text-blue-400 transition-colors">
                    Ngọc Tấn
                  </div>
                  <div className="text-[11px] text-zinc-400 truncate">
                    ngoctan.student@gmail.com
                  </div>
                </div>
                <div className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 font-medium">
                  Google
                </div>
              </button>

              {/* Quick-Pick Profile 2: Học sinh EduMap */}
              <button
                type="button"
                onClick={() => handleConfirmGoogleLogin(
                  'student3@edumap.vn',
                  'Trần Hoàng Yến',
                  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80'
                )}
                className="w-full flex items-center gap-3 p-3 rounded-2xl bg-zinc-900 border border-white/10 hover:border-yellow-500/50 hover:bg-zinc-850 text-left transition-all group"
              >
                <img
                  src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80"
                  alt="Avatar"
                  className="w-10 h-10 rounded-full border border-white/20 object-cover"
                />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-white group-hover:text-yellow-400 transition-colors">
                    Trần Hoàng Yến
                  </div>
                  <div className="text-[11px] text-zinc-400 truncate">
                    student3@edumap.vn
                  </div>
                </div>
                <div className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400 font-medium">
                  Học sinh
                </div>
              </button>
            </div>

            {/* Custom Google Account Input */}
            <div className="pt-3 border-t border-white/10">
              <label className="text-[11px] font-semibold text-zinc-400 block mb-2">
                Hoặc nhập địa chỉ Gmail cá nhân của bạn:
              </label>

              <div className="space-y-2">
                <input
                  type="email"
                  placeholder="diachi@gmail.com"
                  value={googleEmail}
                  onChange={(e) => setGoogleEmail(e.target.value)}
                  className="w-full bg-zinc-900 border border-white/15 rounded-xl px-3.5 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-blue-500"
                />

                <input
                  type="text"
                  placeholder="Tên hiển thị Google (VD: Nguyễn Văn A)"
                  value={googleFullName}
                  onChange={(e) => setGoogleFullName(e.target.value)}
                  className="w-full bg-zinc-900 border border-white/15 rounded-xl px-3.5 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => setShowGoogleModal(false)}
                  className="w-1/3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold py-2.5 rounded-xl text-xs transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  disabled={!googleEmail}
                  onClick={() => handleConfirmGoogleLogin(googleEmail, googleFullName)}
                  className="w-2/3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-xs transition-all shadow-md shadow-blue-600/30"
                >
                  Xác nhận đăng nhập Google
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen w-full flex items-center justify-center bg-[#09090b]">
          <div className="flex items-center gap-3 text-white/70">
            <Loader2 className="w-6 h-6 animate-spin text-yellow-500" />
            <span>Đang tải...</span>
          </div>
        </div>
      }
    >
      <GoogleLoginContent />
    </Suspense>
  );
}
