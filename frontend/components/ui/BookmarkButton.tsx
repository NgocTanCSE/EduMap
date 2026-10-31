'use client';
import { Heart } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useBookmarks } from '@/src/hooks/useBookmarks';
import { useAuth } from '@/src/contexts/AuthContext';

/**
 * Nút đánh dấu (tim) — Icon-only heart button with Orvel styling.
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
      aria-label={on ? 'Bỏ lưu' : 'Lưu vào mục yêu thích'}
      title={on ? 'Bỏ lưu' : 'Lưu vào mục yêu thích'}
      className={cn(
        'inline-flex items-center justify-center rounded-xl border border-border/80 bg-card text-muted-foreground shadow-xs transition-all hover:bg-secondary hover:text-foreground active:scale-95',
        showLabel
          ? (size === 'sm' ? 'h-8 px-3 gap-1.5' : 'h-9 px-3.5 gap-2')
          : (size === 'sm' ? 'h-8 w-8' : 'h-9 w-9'),
        on && 'border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400',
        className,
      )}
    >
      <Heart className={cn('h-4 w-4 transition-transform', on && 'fill-rose-500 text-rose-500 scale-110')} />
      {showLabel && <span className="text-xs font-semibold">{on ? 'Đã lưu' : 'Lưu'}</span>}
    </button>
  );
}
export default BookmarkButton;
