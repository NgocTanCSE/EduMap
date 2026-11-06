"use client";
import React, { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { GraduationCap, Users, User, Briefcase, Shield, Heart, Loader2, ArrowRight, Check, } from 'lucide-react';
import { authService } from '@/src/services/auth.service';
import { configService } from '@/src/services/config.service';
import { UserRole } from '@/src/types/auth-types';
import { EduMapLogo, EduMapWordmark } from '@/components/ui/Logo';
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
    const skipGoogle = false;
    const googleButtonRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (authService.isLoggedIn()) {
            router.replace(redirectUrl);
        }
        else {
            setChecking(false);
        }
    }, [router, redirectUrl]);
    useEffect(() => {
        setIsEmbedded(window.self !== window.top);
    }, []);
    const openedRef = useRef(false);
    const openTopLevelTab = useCallback((force = false) => {
        if (openedRef.current && !force)
            return;
        openedRef.current = true;
        const popup = window.open(window.location.href, '_blank');
        if (!popup) {
            openedRef.current = false;
        }
    }, []);
    useEffect(() => {
        if (!isEmbedded)
            return;
        const onFirstInteraction = () => openTopLevelTab();
        document.addEventListener('click', onFirstInteraction, { capture: true, once: true });
        return () => {
            document.removeEventListener('click', onFirstInteraction, { capture: true });
        };
    }, [isEmbedded, openTopLevelTab]);
    useEffect(() => {
        if (typeof window === 'undefined')
            return;
        if (skipGoogle)
            return;
        let cancelled = false;
        async function init() {
            let clientId: string | undefined;
            try {
                const data = (await configService.get()) as { config?: { googleClientId?: string } };
                clientId = data?.config?.googleClientId;
            }
            catch (err) {
                console.warn('Failed to load /api/config:', err);
            }
            if (!clientId) {
                if (!cancelled) {
                    setErrorMessage('Google OAuth chưa được cấu hình. Thiết lập secret GOOGLE_CLIENT_ID trong môi trường (HF Spaces → Settings → Secrets).');
                }
                return;
            }
            const clientIdValue: string = clientId;
            const script = document.createElement('script');
            script.src = 'https://accounts.google.com/gsi/client';
            script.async = true;
            script.defer = true;
            script.onload = () => {
                try {
                    if (window.google?.accounts?.id) {
                        window.google.accounts.id.initialize({
                            client_id: clientIdValue,
                            callback: handleGoogleCredentialResponse,
                            auto_select: false,
                            cancel_on_tap_outside: true,
                        });
                        const el = googleButtonRef.current;
                        if (el) {
                            el.innerHTML = '';
                            const buttonWidth = Math.max(200, Math.min(320, window.innerWidth - 96));
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
                        if (!cancelled)
                            setGoogleReady(true);
                    }
                }
                catch (err) {
                    console.warn('Google GIS init error:', err);
                    if (!cancelled)
                        setErrorMessage('Không thể khởi tạo Google Identity Services.');
                }
            };
            script.onerror = () => {
                if (!cancelled)
                    setErrorMessage('Không thể tải Google Identity Services script.');
            };
            document.body.appendChild(script);
        }
        init();
        return () => { cancelled = true; };
    }, []);
    const handleGoogleCredentialResponse = async (response: any) => {
        if (!response?.credential)
            return;
        setLoading(true);
        setErrorMessage('');
        try {
            await authService.loginWithGoogle({
                credential: response.credential,
                email: '',
                role: selectedRole,
            });
            router.replace(redirectUrl);
        }
        catch (err: any) {
            setErrorMessage(err.message || 'Đăng nhập với Google thất bại.');
        }
        finally {
            setLoading(false);
        }
    };
    const handleDevLogin = async () => {
        setLoading(true);
        setErrorMessage('');
        try {
            await authService.devLogin();
            router.replace(redirectUrl);
        }
        catch (err: any) {
            setErrorMessage(err.message || 'Dev login thất bại.');
        }
        finally {
            setLoading(false);
        }
    };
    if (checking) {
        return (<div className="min-h-screen w-full flex items-center justify-center bg-background">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin text-primary"/>
          <span>Đang kiểm tra trạng thái đăng nhập…</span>
        </div>
      </div>);
    }
    const selectedRoleObj = ROLES.find(r => r.id === selectedRole) || ROLES[0];
    return (<div className="min-h-screen w-full flex items-center justify-center bg-background px-4 py-12">
      <div className="absolute top-[-15%] left-[20%] w-[400px] h-[400px] bg-primary/5 rounded-full blur-[120px] pointer-events-none"/>
      <div className="absolute bottom-[-15%] right-[20%] w-[400px] h-[400px] bg-primary/5 rounded-full blur-[120px] pointer-events-none"/>

      <div className="w-full max-w-2xl relative z-10">
        <div className="bg-card border border-border rounded-lg p-6 sm:p-10 ">

          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-xs font-medium text-muted-foreground mb-4">
              <EduMapLogo className="h-4 w-4 text-primary"/>
              <span>Hệ thống Bản đồ Giáo dục Thông minh EduMap</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
              Đăng nhập qua Google
            </h1>
            <p className="text-sm text-muted-foreground">
              Chọn vai trò của bạn và đăng nhập một cách an toàn với tài khoản Google của bạn.
            </p>
          </div>

          {errorMessage && (<div className="bg-destructive/10 border border-destructive/30 text-destructive p-3.5 rounded-xl mb-6 text-center text-xs font-semibold flex items-center justify-center gap-2">
              <span>{errorMessage}</span>
            </div>)}

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
            return (<button key={role.id} type="button" onClick={() => setSelectedRole(role.id)} className={`p-3.5 rounded-xl border text-left transition-all duration-200 flex items-start gap-3 relative group ${isSelected
                    ? 'bg-primary/10 border-primary ring-2 ring-primary/40'
                    : 'bg-muted/30 border-border hover:bg-card hover:border-primary/30'}`}>
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors ${isSelected
                    ? 'bg-primary text-primary-foreground shadow-md'
                    : 'bg-muted text-muted-foreground group-hover:text-primary'}`}>
                      <IconComponent className="w-5 h-5"/>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-bold truncate ${isSelected ? 'text-foreground' : 'text-muted-foreground'}`}>
                          {role.label}
                        </span>
                        {isSelected && (<div className="w-4 h-4 rounded-full bg-primary flex items-center justify-center shrink-0 ml-1">
                            <Check className="w-2.5 h-2.5 text-primary-foreground stroke-[3]"/>
                          </div>)}
                      </div>
                      <p className="text-[11px] text-muted-foreground/60 line-clamp-1 mt-0.5">
                        {role.desc}
                      </p>
                    </div>
                  </button>);
        })}
            </div>
          </div>

          
          <div className="space-y-4 pt-2 border-t border-border">


            {!googleReady && (<p className="text-center text-xs text-muted-foreground">
                {errorMessage ? 'Google chưa sẵn sàng.' : 'Đang tải nút đăng nhập Google…'}
              </p>)}

            {loading && (<p className="text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin"/>
                Đang đăng nhập…
              </p>)}

            <p className="text-center text-[11px] text-muted-foreground">
              Vai trò đã chọn:{' '}
              <span className="text-primary font-medium">{selectedRoleObj.label}</span>
            </p>

            {errorMessage && !googleReady && (<div className="text-center text-[11px] text-muted-foreground">
                Kiểm tra secret <code className="bg-muted/50 px-1.5 py-0.5 rounded">GOOGLE_CLIENT_ID</code>{' '}
                trên HF Spaces và Authorized JavaScript origins trong Google Cloud Console.
              </div>)}

            
            <div ref={googleButtonRef} id="google-signin-button" className="w-full min-h-[44px] flex items-center justify-center"/>

            {isEmbedded && (<div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
                <p className="text-sm font-semibold text-foreground">
                  Tab mới sẽ tự mở khi bạn bấm vào trang
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Khung nhúng của Hugging Face chặn cửa sổ popup của Google, nên nút Google
                  có thể không phản hồi ở đây. Tab EduMap vừa mở chính là phiên bản đăng
                  nhập bình thường.
                </p>
                <button type="button" onClick={() => openTopLevelTab(true)} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground transition-colors hover:bg-primary/90">
                  Mở EduMap trong tab mới
                  <ArrowRight className="h-3.5 w-3.5"/>
                </button>
              </div>)}

            <div className="border-t border-border pt-4 mt-2">
              <button type="button" onClick={handleDevLogin} disabled={loading} className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-3 px-4 rounded-xl text-sm transition-all shadow-sm active:scale-[0.98] disabled:opacity-50">
                {loading ? (<Loader2 className="w-4 h-4 animate-spin"/>) : (<ArrowRight className="w-4 h-4"/>)}
                <span>Đăng nhập</span>
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>);
}
export default function LoginPage() {
    return (<Suspense fallback={null}>
      <GoogleLoginContent />
    </Suspense>);
}

declare global {
  interface Window {
    google?: any;
  }
}
