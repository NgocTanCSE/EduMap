"use client";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect all registration requests to Google Sign-In with Role Selection
    router.replace('/auth/login');
  }, [router]);

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#09090b]">
      <div className="flex items-center gap-3 text-white/70">
        <Loader2 className="w-6 h-6 animate-spin text-yellow-500" />
        <span>Đang chuyển hướng đến cổng đăng nhập Google...</span>
      </div>
    </div>
  );
}
