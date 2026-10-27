'use client';

import { AlertOctagon, Home, RotateCcw } from 'lucide-react';

/**
 * Last-resort error boundary (replaces the root layout).
 * No emoji, no light-theme text: vector icon + palette tokens only.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const buttonBase =
    'inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors';

  return (
    <html lang="vi" className="dark">
      <body className="bg-background text-foreground">
        <div className="flex min-h-screen items-center justify-center p-6">
          <div className="w-full max-w-md space-y-5 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl border border-destructive/30 bg-destructive/10">
              <AlertOctagon className="h-7 w-7 text-destructive" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-xl font-semibold">Lỗi hệ thống</h2>
              <p className="text-sm text-foreground/60">
                {error.message || 'Đã xảy ra lỗi nghiêm trọng. Vui lòng liên hệ quản trị viên.'}
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <button
                onClick={reset}
                className={`${buttonBase} bg-primary text-primary-foreground hover:bg-primary/90`}
              >
                <RotateCcw className="h-4 w-4" />
                Thử lại
              </button>
              <button
                onClick={() => { window.location.href = '/'; }}
                className={`${buttonBase} border border-border bg-card text-foreground hover:border-primary/40`}
              >
                <Home className="h-4 w-4" />
                Về trang chủ
              </button>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
