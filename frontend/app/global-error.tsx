'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="vi">
      <body>
        <div className="min-h-screen flex items-center justify-center bg-[#050505] text-white p-8">
          <div className="max-w-md w-full text-center space-y-6">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto">
              <span className="text-3xl">🚨</span>
            </div>
            <h2 className="text-2xl font-bold">Lỗi hệ thống</h2>
            <p className="text-white/60 text-sm">
              {error.message || 'Đã xảy ra lỗi nghiêm trọng. Vui lòng liên hệ quản trị viên.'}
            </p>
            <div className="flex gap-4 justify-center">
              <button
                onClick={reset}
                className="px-6 py-3 bg-yellow-600 hover:bg-yellow-500 text-black font-bold rounded-xl transition-all"
              >
                Thử lại
              </button>
              <button
                onClick={() => window.location.href = '/'}
                className="px-6 py-3 border border-white/10 hover:bg-white/5 font-bold rounded-xl transition-all"
              >
                Về trang chủ
              </button>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
