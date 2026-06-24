"use client";
import { useEffect, useState } from "react";
import { Shield, Plus, Edit, Trash2 } from "lucide-react";
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
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Shield className="w-6 h-6 text-yellow-500" />
          Quản trị – Vai trò
        </h1>
        <button className="px-4 py-2 rounded-xl bg-yellow-600 text-white font-bold hover:bg-yellow-700 flex items-center gap-2">
          <Plus className="w-4 h-4" /> Thêm vai trò
        </button>
      </div>
      {roles.length === 0 ? (
        <p>Chưa có vai trò nào.</p>
      ) : (
        <div className="grid gap-4">
          {roles.map((r: any) => (
            <div key={r.id} className="p-4 border rounded-lg bg-card flex justify-between items-center">
              <div>
                <h3 className="font-bold text-lg">{r.name}</h3>
                <p className="text-sm text-white/60">{r.description || 'Không có mô tả'}</p>
                <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded-full mt-1 inline-block">
                  Cấp độ: {r.level}
                </span>
              </div>
              <div className="flex gap-2">
                <button className="p-2 rounded-lg bg-white/5 hover:bg-white/10">
                  <Edit className="w-4 h-4" />
                </button>
                <button className="p-2 rounded-lg bg-white/5 hover:bg-red-500/20 text-red-400">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
