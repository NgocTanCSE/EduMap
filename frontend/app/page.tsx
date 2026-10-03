'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/src/contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import { EduMapLogo } from '@/components/ui/Logo';

/**
 * Trang gốc `/`.
 * Trước đây là một trang "storefront" giới thiệu 18 tính năng — không đi vào
 * đâu và làm người dùng mất thời gian. Giờ đây `/` chỉ là cổng chuyển hướng:
 *   - Đã đăng nhập  -> /map (bản đồ làm giao diện chính, ngay khi mở app)
 *   - Chưa đăng nhập -> /auth/login (Google-only)
 */
export default function HomeGate() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    router.replace(user ? '/map' : '/auth/login');
  }, [user, loading, router]);

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-background text-foreground">
      <div className="flex items-center gap-3 text-2xl font-semibold">
        <EduMapLogo className="h-7 w-7 text-primary" />
        <span className="font-extrabold">Edu<span className="text-primary">Map</span></span>
      </div>
      <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin text-primary" />
        <span>Đang chuyển hướng bạn tới bản đồ…</span>
      </div>
    </div>
  );
}
