'use client';
import { Heart } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useBookmarks } from '@/src/hooks/useBookmarks';
import { useAuth } from '@/src/contexts/AuthContext';

/**
 * Nút đánh dấu (tim) — dùng chung cho cả list card và trang chi tiết (context).
 * Trạng thái dựa trên cache của useBookmarks; toggle ngay (optimistic) rồi POST.
 */
export function BookmarkButton({
  targetType,
  targetId,
  size = 'sm',
  showLabel = false,
  className,
}: {
  targetType: string;
  targetId: string;
  size?: 'sm' | 'md';
  showLabel?: boolean;
  className?: string;
}) {
  const { has, toggle, loading } = useBookmarks();
  const { isLoggedIn } = useAuth();
  const on = has(targetType, targetId);

  return (
    <button
      type="button"
      disabled={loading}
      onClick={async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!isLoggedIn) {
          window.location.href = `/auth/login?redirect=${encodeURIComponent(window.location.pathname)}`;
          return;
        }
        await toggle(targetType, targetId);
      }}
      aria-label={on ? 'Bỏ đánh dấu' : 'Đánh dấu'}
      className={cn(
        'inline-flex items-center justify-center rounded-lg border border-border bg-background/60 text-muted-foreground transition hover:bg-muted hover:text-foreground',
        size === 'sm' ? 'h-7 px-2' : 'h-8 px-3',
        className,
      )}
    >
      <Heart className={cn('h-3.5 w-3.5', on && 'fill-primary text-primary')} />
      {showLabel && <span className="ml-1 text-xs font-medium">{on ? 'Đã lưu' : 'Lưu'}</span>}
    </button>
  );
}
