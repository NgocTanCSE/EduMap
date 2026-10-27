'use client';

import { useCallback, useEffect, useState } from 'react';
import { Bell, Check, Loader2, RefreshCw } from 'lucide-react';
import {
  notificationService,
  type Notification,
} from '@/reporting/services/notification.service';
import { useAuth } from '@/src/contexts/AuthContext';
import { toast } from 'sonner';

export function PersonalNotifications() {
  const { isLoggedIn, loading: authLoading } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 5;

  const load = useCallback(async () => {
    if (!isLoggedIn) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setLoadError(null);
      const data = await notificationService.getMyNotifications();
      setNotifications(Array.isArray(data.notifications) ? data.notifications : []);
    } catch (error: any) {
      const message = error?.message || 'Không thể tải thông báo';
      setLoadError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [isLoggedIn]);

  useEffect(() => {
    if (authLoading) return;
    load();
  }, [authLoading, load]);

  const totalPages = Math.ceil(notifications.length / pageSize);
  const displayed = notifications.slice((page - 1) * pageSize, page * pageSize);
  const unread = notifications.filter((n) => !n.is_read).length;

  const handleMarkRead = async (id: string) => {
    try {
      await notificationService.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n,
        ),
      );
      toast.success('Đã đánh dấu là đã đọc');
    } catch (error: any) {
      toast.error(error?.message || 'Không thể cập nhật thông báo');
    }
  };

  if (!isLoggedIn) {
    return <p className="text-sm text-muted-foreground/60">Đăng nhập để xem thông báo.</p>;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold">Thông báo</h3>
          <p className="mt-1 text-sm text-muted-foreground/60">
            Cập nhật mới nhất từ EduMap.
          </p>
        </div>
        {!loadError && unread > 0 && (
          <span className="self-start rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            {unread} chưa đọc
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Đang tải...
        </div>
      ) : loadError ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 py-8 text-center">
          <p className="text-sm text-destructive">{loadError}</p>
          <button
            type="button"
            onClick={load}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-muted"
          >
            <RefreshCw className="h-3 w-3" /> Thử lại
          </button>
        </div>
      ) : displayed.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-10 text-center">
          <Bell className="mx-auto mb-3 h-10 w-10 text-muted-foreground/20" />
          <p className="text-sm text-muted-foreground/60">Không có thông báo nào.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {displayed.map((n) => (
            <li
              key={n.id}
              className={`flex items-start gap-3 rounded-lg border p-4 ${
                n.is_read
                  ? 'border-border bg-background/40'
                  : 'border-primary/20 bg-primary/5'
              }`}
            >
              <span
                className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                  n.is_read ? 'bg-muted-foreground/30' : 'bg-primary'
                }`}
              />
              <div className="min-w-0 flex-1">
                <p className="font-medium">{n.title || n.body || 'Thông báo'}</p>
                {n.body && n.title && (
                  <p className="mt-1 text-sm text-muted-foreground/70">{n.body}</p>
                )}
                <p className="mt-1.5 text-xs text-muted-foreground/65">
                  {new Date(n.sent_at || n.read_at || Date.now()).toLocaleString('vi-VN')}
                </p>
              </div>
              {!n.is_read && (
                <button
                  type="button"
                  onClick={() => handleMarkRead(n.id)}
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
                >
                  <Check className="h-3 w-3" /> Đã đọc
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium disabled:opacity-40"
          >
            ← Trước
          </button>
          <span className="text-xs text-muted-foreground/60">
            Trang {page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium disabled:opacity-40"
          >
            Tiếp →
          </button>
        </div>
      )}
    </div>
  );
}
