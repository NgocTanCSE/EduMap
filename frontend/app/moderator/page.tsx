"use client";
import { useEffect, useState } from "react";
import { moderatorService } from "@/src/services/moderator.service";

export default function ModeratorPage() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await moderatorService.getPendingPosts();
        setTasks(data ?? []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <div className="p-8 text-center">Đang tải…</div>;

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6">Bảng điều khiển Moderator</h1>
      {tasks.length === 0 ? (
        <p>Không có nội dung cần duyệt.</p>
      ) : (
        <ul className="space-y-2">
          {tasks.map((t: any) => (
            <li key={t.id} className="p-2 border rounded bg-card">
              {t.title}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
