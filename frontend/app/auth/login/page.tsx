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
  Loader2,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Check,
} from 'lucide-react';
import { authService } from '@/src/services/auth.service';
import { UserRole } from '@/src/types/auth-types';
import { EduMapLogo, EduMapWordmark } from '@/components/ui/Logo';

// Google "G" icon (Multicolor — official Google brand colors)
function GoogleIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.36 24 12 24z" />
      <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z" />
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.36 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z" />
    </svg>
  );
}

/** Role options for role-based Google OAuth.
 *  Each role maps to a UserRole enum value and carries the backend
 *  interpretation of that role. Colors use the amber primary palette. */
const ROLES = [
  {
    id: UserRole.STUDENT,
    label: 'Học sinh / Sinh viên',
    desc: 'Học tập, tìm đường, thư viện tài liệu & học bổng',
    icon: GraduationCap,
  },
  {
    id: UserRole.PARENT,
    label: 'Phụ huynh',
    desc: 'Theo dõi lộ trình, trường học & an toàn di chuyển',
    icon: Users,
  },
  {
    id: UserRole.TEACHER,
    label: 'Giảng viên / Giáo viên',
    desc: 'Chia sẻ tài liệu, hướng dẫn và kết nối người học',
    icon: User,
  },
  {
    id: UserRole.MENTOR,
    label: 'Chuyên gia tư vấn (Mentor)',
    desc: 'Tư vấn nghề nghiệp, định hướng đại học & việc làm',
    icon: Briefcase,
  },
  {
    id: UserRole.SCHOOL_REP,
    label: 'Đại diện trường học',
    desc: 'Quản lý điểm giáo dục, thông tin tuyển sinh & sự kiện',
    icon: Shield,
  },
  {
    id: UserRole.EMPLOYER,
    label: 'Đơn vị tuyển dụng',
    desc: 'Tìm kiếm nhân tài, cấp cơ hội thực tập & việc làm',
    icon: Briefcase,
  },
  {
    id: UserRole.DONOR,
    label: 'Mạnh thường quân',
    desc: 'Tài trợ học bổng, chiến dịch thiện nguyện & thiết bị',
    icon: Heart,
  },
  {
    id: UserRole.ADMIN,
    label: 'Quản trị viên',
    desc: 'Giám sát toàn bộ hệ thống & phân tích số liệu',
    icon: Shield,
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
  const [googleReady, setGoogleReady] = useState(false);

  useEffect(() => {
    if (authService.isLoggedIn()) {
      router.replace(redirectUrl);
    } else {
      setChecking(false);
    }
  }, [router, redirectUrl]);

  // ── Fetch runtime config + Load Google Identity Services SDK ──
  // The Google Client ID is read at *runtime* from our BFF /api/config
  // endpoint so that Space Secrets (HF Spaces) and runtime env vars work
  // even though NEXT_PUBLIC_* values are inlined at build time.
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let cancelled = false;

    async function init() {
      // Fetch the client ID from our BFF (runtime-accessible env var)
      const res = await fetch('/api/config');
      const { config } = await res.json();
      const clientId = config?.googleClientId;

      if (!clientId) {
        if (!cancelled) {
          setErrorMessage(
            'Google OAuth chưa được cấu hình. Vui lòng thiết lập NEXT_PUBLIC_GOOGLE_CLIENT_ID / GOOGLE_CLIENT_ID trong môi trường.'
          );
        }
        return;
      }

      // Load the official Google Identity Services script
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        try {
          // @ts-ignore — Google GIS types are not bundled with Next.js
          if (window.google?.accounts?.id) {
            // @ts-ignore
            window.google.accounts.id.initialize({
              client_id: clientId,
              callback: handleGoogleCredentialResponse,
            });
            if (!cancelled) setGoogleReady(true);
          }
        } catch (err) {
          console.warn('Google GIS init error:', err);
          if (!cancelled) setErrorMessage('Không thể khởi tạo Google Identity Services.');
        }
      };
      script.onerror = () => {
        if (!cancelled) setErrorMessage('Không thể tải Google Identity Services script.');
      };
      document.body.appendChild(script);
    }

    init();

    return () => { cancelled = true; };
  }, []);

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

  const handleGoogleLogin = () => {
    if (!googleReady) return;
    try {
      // @ts-ignore
      window.google.accounts.id.prompt({
        // Show the One Tap prompt for immediate Google sign-in
        auto_select: true,
      });
    } catch (e) {
      console.warn('Google One Tap prompt failed:', e);
      // Fallback: render the Google Sign-In button explicitly
      // @ts-ignore
      window.google.accounts.id.renderButton(
        document.getElementById('google-signin-button'),
        { theme: 'outline', size: 'large', shape: 'rectangular' }
      );
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <span>Đang kiểm tra trạng thái đăng nhập…</span>
        </div>
      </div>
    );
  }

  const selectedRoleObj = ROLES.find(r => r.id === selectedRole) || ROLES[0];

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background px-4 py-12">
      {/* Subtle primary glow behind the card */}
      <div className="absolute top-[-15%] left-[20%] w-[400px] h-[400px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-15%] right-[20%] w-[400px] h-[400px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-2xl relative z-10">
        <div className="bg-card border border-border rounded-2xl p-6 sm:p-10 shadow-xl">

          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-xs font-medium text-muted-foreground mb-4">
              <EduMapLogo className="h-4 w-4 text-primary" />
              <span>Hệ thống Bản đồ Giáo dục Thông minh EduMap</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
              Đăng nhập qua Google
            </h1>
            <p className="text-sm text-muted-foreground">
              Chọn vai trò của bạn và đăng nhập một cách an toàn với tài khoản Google của bạn.
            </p>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="bg-destructive/10 border border-destructive/30 text-destructive p-3.5 rounded-xl mb-6 text-center text-xs font-semibold flex items-center justify-center gap-2">
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Step 1: Role Selection */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-3 px-1">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Chọn vai trò của bạn
              </label>
              <span className="text-xs text-primary font-medium">
                Đang chọn: {selectedRoleObj.label}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
              {ROLES.map((role) => {
                const isSelected = selectedRole === role.id;
                const IconComponent = role.icon;
                return (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => setSelectedRole(role.id)}
                    className={`p-3.5 rounded-xl border text-left transition-all duration-200 flex items-start gap-3 relative group ${
                      isSelected
                        ? 'bg-primary/10 border-primary ring-2 ring-primary/40'
                        : 'bg-muted/30 border-border hover:bg-card hover:border-primary/30'
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                      isSelected
                        ? 'bg-primary text-primary-foreground shadow-md'
                        : 'bg-muted text-muted-foreground group-hover:text-primary'
                    }`}>
                      <IconComponent className="w-5 h-5" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-bold truncate ${isSelected ? 'text-foreground' : 'text-muted-foreground'}`}>
                          {role.label}
                        </span>
                        {isSelected && (
                          <div className="w-4 h-4 rounded-full bg-primary flex items-center justify-center shrink-0 ml-1">
                            <Check className="w-2.5 h-2.5 text-primary-foreground stroke-[3]" />
                          </div>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground/60 line-clamp-1 mt-0.5">
                        {role.desc}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step 2: Google Login Button */}
          <div className="space-y-4 pt-2 border-t border-border">
            {process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ? (
              <>
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={loading || !googleReady}
                  className="w-full flex items-center justify-center gap-3 bg-white hover:bg-zinc-100 text-zinc-900 font-medium py-3 px-6 rounded-xl text-sm transition-all shadow-md disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin text-zinc-900" />
                      <span>Đang kết nối tài khoản Google…</span>
                    </>
                  ) : (
                    <>
                      <GoogleIcon className="w-5 h-5 shrink-0" />
                      <span>Đăng nhập với Google ({selectedRoleObj.label})</span>
                    </>
                  )}
                </button>

                {/* Google Sign-In button container (used as fallback) */}
                <div id="google-signin-button" className="hidden" />
              </>
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                <p className="text-sm mb-2">Google OAuth chưa được cấu hình.</p>
                <p className="text-xs">
                  Thiết lập <code className="bg-muted/50 px-2 py-1 rounded">NEXT_PUBLIC_GOOGLE_CLIENT_ID</code>{' '}
                  trong môi trường để kích hoạt đăng nhập Google.
                </p>
              </div>
            )}

            {/* Privacy notice */}
            <div className="bg-card/40 border border-border rounded-xl p-3.5 flex items-center gap-3 text-xs text-muted-foreground">
              <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
              <p className="leading-relaxed">
                Hệ thống sẽ đồng bộ hóa Avatar, Họ tên và Email từ tài khoản Google của bạn.
              </p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <GoogleLoginContent />
    </Suspense>
  );
}
