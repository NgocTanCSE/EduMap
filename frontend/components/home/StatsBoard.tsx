"use client";
import React, { useEffect, useState } from 'react';

export default function StatsBoard() {
  const [stats, setStats] = useState<any>({
    total_users: '100+',
    total_locations: '100+',
    total_materials: '100+',
    system_ready: '100%'
  });

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch('/api/analytics/stats');
        if (res.ok) {
          const data = await res.json();
          setStats({
            total_users: `${data.total_users}+`,
            total_locations: `${data.total_locations}+`,
            total_materials: `${data.total_materials}+`,
            system_ready: data.system_ready
          });
        }
      } catch (error) {
        console.error("Error fetching stats:", error);
      }
    }
    fetchStats();
  }, []);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6 sm:p-8 rounded-3xl border border-white/10 bg-zinc-900/60 shadow-xl">
      <div className="text-center md:border-r border-white/5 py-2">
        <div className="text-3xl sm:text-4xl font-extrabold text-yellow-500">{stats.total_locations}</div>
        <div className="text-xs sm:text-sm text-foreground/50 font-medium mt-1">Ghim PostGIS Đã Seed</div>
      </div>
      <div className="text-center md:border-r border-white/5 py-2">
        <div className="text-3xl sm:text-4xl font-extrabold text-emerald-500">{stats.total_materials}</div>
        <div className="text-xs sm:text-sm text-foreground/50 font-medium mt-1">Học liệu Đã Nạp</div>
      </div>
      <div className="text-center md:border-r border-white/5 py-2">
        <div className="text-3xl sm:text-4xl font-extrabold text-indigo-500">{stats.total_users}</div>
        <div className="text-xs sm:text-sm text-foreground/50 font-medium mt-1">Tài khoản & Nhóm Học</div>
      </div>
      <div className="text-center py-2">
        <div className="text-3xl sm:text-4xl font-extrabold text-violet-500">{stats.system_ready}</div>
        <div className="text-xs sm:text-sm text-foreground/50 font-medium mt-1">PostgreSQL & PostGIS Sẵn sàng</div>
      </div>
    </div>
  );
}
