"use client";
import React, { useState, useEffect, useRef, useCallback, Suspense } from 'react';
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
  Check,
} from 'lucide-react';
import { authService } from '@/src/services/auth.service';
import { UserRole } from '@/src/types/auth-types';
import { EduMapLogo, EduMapWordmark } from '@/components/ui/Logo';

// Google renders its own "Sign in with Google" button via Identity Services,
// so the custom multicolour icon is no longer needed.

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
  const [isEmbedded, setIsEmbedded] = useState(false);
  const googleButtonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (authService.isLoggedIn()) {
      router.replace(redirectUrl);
    } else {
      setChecking(false);
    }
  }, [router, redirectUrl]);

  // Hugging Face renders the Space inside an iframe that sends
  // `Cross-Origin-Opener-Policy: same-origin`. That severs `window.opener`
  // for Google's OAuth popup, so the popup can never post the credential
  // back and ends up stuck on the blank `accounts.google.com/gsi/transform`
  // page. Detect the embed and send the user to a real top-level tab.
  useEffect(() => {
    setIsEmbedded(window.self !== window.top);
  }, []);

  // "Chuyển hướng tự động" cho khung nhúng (HF Space): trang huggingface.co
  // gửi `Cross-Origin-Opener-Policy: same-origin`, popup Google mất
  // window.opener → trang gsi/transform không gửi credential về được và treo
  // trắng. Cách duy nhất hoạt động được là mở lại trang đăng nhập ở một tab
  // top-level thật. Tự động mở 1 lần ngay ở tương tác đầu tiên; nút bên dưới
  // thì bấm bao nhiêu lần cũng cho mở lại.
  const openedRef = useRef(false);

  const openTopLevelTab = useCallback((force = false) => {
    if (openedRef.current && !force) return;
    openedRef.current = true;
    const popup = window.open(window.location.href, '_blank');
    if (!popup) {
      // Trình duyệt chặn cửa sổ — cho phép thử lại (nút CTA truyền force=true).
      openedRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!isEmbedded) return;
    const onFirstInteraction = () => openTopLevelTab();
    document.addEventListener('click', onFirstInteraction, { capture: true, once: true });
    return () => {
      document.removeEventListener('click', onFirstInteraction, { capture: true });
    };
  }, [isEmbedded, openTopLevelTab]);

  // ── Fetch runtime config + Load Google Identity Services SDK ──
  // The Google Client ID is read at *runtime* from our BFF /api/config
  // endpoint so that Space Secrets (HF Spaces) and runtime env vars work
  // even though NEXT_PUBLIC_* values are inlined at build time.
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // NOTE: GIS is intentionally loaded even when this page is embedded in an
    // iframe (Hugging Face Space view). The popup itself cannot post the
    // credential back to us there because of the parent page's COOP header,
    // but the first user interaction auto-opens a top-level tab (see below),
    // so the Google button stays visible as the primary login affordance.

    let cancelled = false;

    async function init() {
      // Fetch the client ID from our BFF (runtime-accessible env var).
      // `no-store` avoids a stale empty response cached from before the
      // /api/config route was made dynamic.
      let clientId: string | undefined;
      try {
        const res = await fetch('/api/config', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          clientId = data?.config?.googleClientId;
        }
      } catch (err) {
        console.warn('Failed to load /api/config:', err);
      }

      if (!clientId) {
        if (!cancelled) {
          setErrorMessage(
            'Google OAuth chưa được cấu hình. Thiết lập secret GOOGLE_CLIENT_ID trong môi trường (HF Spaces → Settings → Secrets).'
          );
        }
        return;
      }

      // Bind to a const so TypeScript keeps the string narrowing inside the
      // async GIS callback below.
      const clientIdValue: string = clientId;

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
              client_id: clientIdValue,
              callback: handleGoogleCredentialResponse,
              auto_select: false,
              cancel_on_tap_outside: true,
            });

            // Render the OFFICIAL Google button. Do NOT rely on One Tap
            // (`id.prompt()`): it is suppressed silently when FedCM/3rd-party
            // cookies are blocked or the exact origin is not authorized for
            // the client ID, so clicking a custom button appears to do nothing.
            const el = googleButtonRef.current;
            if (el) {
              el.innerHTML = '';
              // Keep Google's button inside the card on small screens.
              const buttonWidth = Math.max(200, Math.min(320, window.innerWidth - 96));
              // @ts-ignore
              window.google.accounts.id.renderButton(el, {
                type: 'standard',
                theme: 'outline',
                size: 'large',
                text: 'signin_with',
                shape: 'rectangular',
                logo_alignment: 'left',
                locale: 'vi',
                width: buttonWidth,
              });
            }
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

  const handleDevLogin = async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      await authService.devLogin();
      router.replace(redirectUrl);
    } catch (err: any) {
      setErrorMessage(err.message || 'Dev login thất bại.');
    } finally {
      setLoading(false);
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
        <div className="bg-card border border-border rounded-lg p-6 sm:p-10 ">

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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[300px] overflow-y-auto pr-1 scrollbar-hide">
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
            {/* Google renders its own button here on click it ALWAYS opens the
                account chooser, unlike One Tap prompt() which fails silently.
                It is the primary affordance in every context (tab or embed). */}
            <div
              ref={googleButtonRef}
              id="google-signin-button"
              className="w-full min-h-[44px] flex items-center justify-center"
            />

            {isEmbedded && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
                <p className="text-sm font-semibold text-foreground">
                  Tab mới sẽ tự mở khi bạn bấm vào trang
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Khung nhúng của Hugging Face chặn cửa sổ popup của Google, nên nút Google
                  có thể không phản hồi ở đây. Tab EduMap vừa mở chính là phiên bản đăng
                  nhập bình thường.
                </p>
                <button
                  type="button"
                  onClick={() => openTopLevelTab(true)}
                  className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  Mở EduMap trong tab mới
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {!googleReady && (
              <p className="text-center text-xs text-muted-foreground">
                {errorMessage ? 'Google chưa sẵn sàng.' : 'Đang tải nút đăng nhập Google…'}
              </p>
            )}

            {loading && (
              <p className="text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Đang kết nối tài khoản Google…
              </p>
            )}

            <p className="text-center text-[11px] text-muted-foreground">
              Vai trò đã chọn:{' '}
              <span className="text-primary font-medium">{selectedRoleObj.label}</span>
            </p>

            {errorMessage && !googleReady && (
              <div className="text-center text-[11px] text-muted-foreground">
                Kiểm tra secret <code className="bg-muted/50 px-1.5 py-0.5 rounded">GOOGLE_CLIENT_ID</code>{' '}
                trên HF Spaces và Authorized JavaScript origins trong Google Cloud Console.
              </div>
            )}

            {/* Dev Login — fallback for local testing when Google OAuth is NOT
                configured (or the button cannot render). Hidden from production
                builds and hidden as soon as the Google button is ready, so the
                Google iframe stays the primary login affordance. */}
            {process.env.NODE_ENV !== 'production' && !googleReady && (
              <div className="border-t border-border pt-4 mt-2">
                <button
                  type="button"
                  onClick={handleDevLogin}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 bg-primary/15 hover:bg-primary/25 text-primary font-medium py-2.5 px-4 rounded-xl text-sm transition-all border border-primary/30 disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  <span>Dev Login (bypass Google OAuth)</span>
                </button>
                <p className="text-[10px] text-muted-foreground/60 text-center mt-1.5">
                  Dành cho môi trường phát triển — tạo JWT hợp lệ để test toàn bộ tính năng.
                </p>
              </div>
            )}
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
