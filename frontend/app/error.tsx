'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, Home, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Route-level error boundary.
 * Icon is a lucide vector; buttons use the palette tokens
 * (`text-primary-foreground` on terracotta) instead of light-theme text.
 */
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
    <div className="flex min-h-[70vh] items-center justify-center bg-background p-6 text-foreground">
      <div className="w-full max-w-md space-y-5 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl border border-destructive/30 bg-destructive/10">
          <AlertTriangle className="h-7 w-7 text-destructive" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-xl font-semibold">Không thể tải trang</h2>
          <p className="text-sm text-foreground/60">
            {error.message || 'Đã xảy ra lỗi khi tải nội dung này.'}
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={reset} className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
            <RotateCcw className="h-4 w-4" />
            Thử lại
          </Button>
          <Link
            href="/"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-primary/20 px-4 text-sm font-medium text-foreground transition-colors hover:bg-primary/10"
          >
            <Home className="h-4 w-4" />
            Về trang chủ
          </Link>
        </div>
      </div>
    </div>
  );
}
