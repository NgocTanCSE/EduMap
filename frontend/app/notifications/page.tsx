// Simple Notification Center placeholder
"use client";
import { useEffect, useState } from "react";
import { notificationService } from "@/src/services/notification.service";

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await notificationService.getMyNotifications();
        setNotifications(data.notifications ?? []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <div className="p-8 text-center">Đang tải thông báo…</div>;

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6">Thông báo</h1>
      {notifications.length === 0 ? (
        <p>Không có thông báo nào.</p>
      ) : (
        <ul className="space-y-4">
          {notifications.map((n: any) => (
            <li key={n.id} className="p-4 border rounded-lg bg-card">
              <p>{n.message}</p>
              <small className="text-gray-500">{new Date(n.created_at).toLocaleString()}</small>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
