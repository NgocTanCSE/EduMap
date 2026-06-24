'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Route error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#050505] text-white p-8">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto">
          <span className="text-3xl">⚠️</span>
        </div>
        <h2 className="text-2xl font-bold">Không thể tải trang</h2>
        <p className="text-white/60 text-sm">
          {error.message || 'Đã xảy ra lỗi khi tải nội dung này.'}
        </p>
        <div className="flex gap-4 justify-center">
          <Button onClick={reset} className="bg-yellow-600 hover:bg-yellow-500 text-black">
            Thử lại
          </Button>
          <Button variant="outline" onClick={() => window.location.href = '/'}>
            Về trang chủ
          </Button>
        </div>
      </div>
    </div>
  );
}
