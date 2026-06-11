"use client";
import { useEffect, useState } from "react";
import { adminService } from "@/src/services/admin.service";

export default function AdminRolesPage() {
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRoles() {
      try {
        const data = await adminService.getRoles();
        setRoles(data ?? []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    fetchRoles();
  }, []);

  if (loading) return <div className="p-8 text-center">Đang tải…</div>;

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6">Quản trị – Vai trò</h1>
      {roles.length === 0 ? (
        <p>Chưa có vai trò nào.</p>
      ) : (
        <ul className="space-y-2">
          {roles.map((r: any) => (
            <li key={r.id} className="p-2 border rounded bg-card">
              {r.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
