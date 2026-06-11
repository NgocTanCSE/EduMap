// Simple Notification Center placeholder with pagination & mark‑as‑read
"use client";
import { useEffect, useState } from "react";
import { notificationService } from "@/src/services/notification.service";
import { Button } from "@/components/ui/button";

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const pageSize = 5;

  const fetchNotifications = async () => {
    const data = await notificationService.getMyNotifications();
    setNotifications(data.notifications ?? []);
  };

  useEffect(() => {
    async function load() {
      try {
        await fetchNotifications();
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const totalPages = Math.ceil(notifications.length / pageSize);
  const displayed = notifications.slice((page - 1) * pageSize, page * pageSize);

  const handleMarkRead = async (id: string) => {
    try {
      await notificationService.markAsRead(id);
      setNotifications(prev => prev.map(n => (n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n)));
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) return <div className="p-8 text-center">Đang tải thông báo…</div>;

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6">Thông báo</h1>
      {displayed.length === 0 ? (
        <p>Không có thông báo nào.</p>
      ) : (
        <ul className="space-y-4">
          {displayed.map((n: any) => (
            <li key={n.id} className="p-4 border rounded-lg bg-card flex justify-between items-start space-x-4">
              <div className="flex-1">
                <p className="font-medium">{n.title ?? n.message}</p>
                {n.body && <p className="text-sm text-foreground/70 mt-1">{n.body}</p>}
                <small className="text-gray-500 block mt-2">{new Date(n.sent_at ?? n.timestamp).toLocaleString()}</small>
              </div>
              {!n.is_read && (
                <Button variant="outline" size="sm" onClick={() => handleMarkRead(n.id)}>
                  Đánh dấu đã đọc
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center mt-6 space-x-4">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => Math.max(p - 1, 1))}>
            ← Trước
          </Button>
          <span>Trang {page} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => Math.min(p + 1, totalPages))}>
            Tiếp →
          </Button>
        </div>
      )}
    </div>
  );
}
