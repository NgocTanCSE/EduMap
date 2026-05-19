"use client";
import React, { useState } from 'react';
import { Shield, User, Search, MoreVertical, CheckCircle, XCircle, AlertTriangle, ShieldAlert } from 'lucide-react';

const users = [
  { id: 1, name: 'Lê Ngọc Tân', email: 'tan.le@example.com', role: 'ADMIN', status: 'active', source: 'MANUAL', joinDate: '12/05/2026' },
  { id: 2, name: 'Nguyễn Văn A', email: 'a.nguyen@example.com', role: 'STUDENT', status: 'active', source: 'AUTO (EMAIL)', joinDate: '14/05/2026' },
  { id: 3, name: 'Trần Thị B', email: 'b.tran@example.com', role: 'MENTOR', status: 'pending', source: 'AUTO (APP)', joinDate: '15/05/2026' },
];

const roles = ['ADMIN', 'STUDENT', 'MENTOR', 'ORGANIZATION', 'DONOR', 'MODERATOR'];

export default function AdminRolesPage() {
  const [searchTerm, setSearchTerm] = useState('');

  return (
    <div className="min-h-screen bg-[#050505] text-white p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <ShieldAlert className="w-8 h-8 text-red-500" />
              Quản lý Quyền hạn
            </h1>
            <p className="text-white/40 text-sm">Quản lý 12 vai trò người dùng trong hệ sinh thái EduMap.</p>
          </div>
          <div className="flex gap-4">
             <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-center">
                <p className="text-xl font-bold">12</p>
                <p className="text-[10px] text-white/40 uppercase font-bold">Tổng số vai trò</p>
             </div>
             <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-center">
                <p className="text-xl font-bold">1,254</p>
                <p className="text-[10px] text-white/40 uppercase font-bold">Tổng người dùng</p>
             </div>
          </div>
        </div>

        {/* Search & Actions */}
        <div className="flex gap-4 items-center p-4 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-xl">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
            <input 
              type="text" 
              placeholder="Tìm kiếm theo tên hoặc email..." 
              className="w-full bg-white/5 border border-white/5 rounded-2xl py-3 pl-12 pr-4 text-sm outline-none focus:border-blue-500 transition-colors"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button className="px-6 py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-sm font-bold transition-all">Xuất báo cáo</button>
        </div>

        {/* Users Table */}
        <div className="rounded-[32px] overflow-hidden border border-white/10 bg-white/5 backdrop-blur-xl">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/5">
                <th className="p-6 text-xs font-bold text-white/40 uppercase">Người dùng</th>
                <th className="p-6 text-xs font-bold text-white/40 uppercase">Vai trò</th>
                <th className="p-6 text-xs font-bold text-white/40 uppercase">Nguồn gốc</th>
                <th className="p-6 text-xs font-bold text-white/40 uppercase">Trạng thái</th>
                <th className="p-6 text-xs font-bold text-white/40 uppercase">Ngày gia nhập</th>
                <th className="p-6 text-xs font-bold text-white/40 uppercase text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {users.map(user => (
                <tr key={user.id} className="hover:bg-white/5 transition-colors">
                  <td className="p-6">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-sm font-bold">
                        {user.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-bold">{user.name}</p>
                        <p className="text-[10px] text-white/40">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-6">
                    <select className="bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white/80 outline-none focus:border-blue-500">
                      {roles.map(role => (
                        <option key={role} value={role} selected={role === user.role}>{role}</option>
                      ))}
                    </select>
                  </td>
                  <td className="p-6">
                    <span className={`px-2 py-1 rounded bg-white/5 border border-white/10 text-[9px] font-bold ${user.source === 'MANUAL' ? 'text-blue-400' : 'text-purple-400'}`}>
                      {user.source}
                    </span>
                  </td>
                  <td className="p-6">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${user.status === 'active' ? 'bg-green-500/10 text-green-500' : 'bg-yellow-500/10 text-yellow-500'}`}>
                      {user.status === 'active' ? <CheckCircle className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                      {user.status}
                    </span>
                  </td>
                  <td className="p-6 text-xs text-white/40">{user.joinDate}</td>
                  <td className="p-6 text-right">
                    <button className="p-2 rounded-lg hover:bg-white/10 transition-colors">
                      <MoreVertical className="w-5 h-5 text-white/30" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Warning Section */}
        <div className="p-6 rounded-3xl bg-red-500/5 border border-red-500/10 flex gap-6 items-center">
           <div className="p-4 bg-red-500/10 rounded-2xl">
              <Shield className="w-8 h-8 text-red-500" />
           </div>
           <div>
              <h4 className="font-bold text-red-500 mb-1">Cảnh báo bảo mật</h4>
              <p className="text-xs text-white/40 leading-relaxed">
                Việc thay đổi vai trò ảnh hưởng trực tiếp đến quyền truy cập dữ liệu nhạy cảm. Mọi thao tác thay đổi vai trò sẽ được ghi lại trong nhật ký hệ thống (Audit Log).
              </p>
           </div>
        </div>

      </div>
    </div>
  );
}
