"use client";
import React, { useState, useEffect } from 'react';
import { adminService, User } from '@/services/admin.service';
import { 
  Users, Search, MoreVertical, CheckCircle, XCircle, 
  AlertTriangle, Shield, ChevronLeft, ChevronRight, Filter
} from 'lucide-react';

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 10, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const fetchUsers = async (page = 1) => {
    setLoading(true);
    try {
      const response = await adminService.getUsers({ 
        page, 
        limit: 10, 
        search: searchTerm,
        status: statusFilter
      });
      setUsers(response.items);
      setMeta(response.meta);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers(meta.page);
  }, [meta.page, statusFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchUsers(1);
  };

  const handleUpdateStatus = async (userId: string, status: string) => {
    if (!confirm(`Bạn có chắc chắn muốn thay đổi trạng thái người dùng sang ${status}?`)) return;
    try {
      await adminService.updateUserStatus(userId, status);
      fetchUsers(meta.page);
    } catch (error) {
      alert('Cập nhật trạng thái thất bại');
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3 text-yellow-500">
              <Users className="w-8 h-8" />
              Quản lý Người dùng
            </h1>
            <p className="text-white/40 text-sm mt-1">Quản trị toàn bộ tài khoản người dùng trong hệ thống.</p>
          </div>
          <div className="flex gap-4">
             <div className="p-4 rounded-2xl bg-zinc-900 border border-white/10 text-center">
                <p className="text-xl font-bold">{meta.total}</p>
                <p className="text-[10px] text-white/40 uppercase font-bold">Tổng người dùng</p>
             </div>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="flex flex-wrap gap-4 items-center p-4 rounded-3xl bg-zinc-900/50 border border-white/10">
          <form onSubmit={handleSearch} className="flex-1 min-w-[300px] relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
            <input 
              type="text" 
              placeholder="Tìm kiếm theo tên hoặc email..." 
              className="w-full bg-zinc-900 border border-white/5 rounded-2xl py-3 pl-12 pr-4 text-sm outline-none focus:border-yellow-500 transition-colors"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </form>
          
          <div className="flex items-center gap-2 bg-zinc-900 border border-white/5 rounded-2xl px-4 py-2">
            <Filter className="w-4 h-4 text-white/30" />
            <select 
              className="bg-transparent text-sm outline-none"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">Tất cả trạng thái</option>
              <option value="active">Đang hoạt động</option>
              <option value="banned">Bị chặn</option>
              <option value="pending">Chờ xác minh</option>
            </select>
          </div>

          <button 
            onClick={() => fetchUsers(1)}
            className="px-6 py-3 rounded-2xl bg-yellow-600 hover:bg-yellow-500 text-sm font-bold transition-all"
          >
            Tìm kiếm
          </button>
        </div>

        {/* Users Table */}
        <div className="rounded-[32px] overflow-hidden border border-white/10 bg-zinc-900/30">
          {loading ? (
            <div className="p-20 text-center text-white/40">Đang tải dữ liệu...</div>
          ) : (
            <>
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-zinc-900/50">
                    <th className="p-6 text-xs font-bold text-white/40 uppercase">Người dùng</th>
                    <th className="p-6 text-xs font-bold text-white/40 uppercase">Vai trò</th>
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
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-500/20 to-purple-600/20 flex items-center justify-center text-sm font-bold border border-white/10">
                            {user.full_name?.charAt(0) || user.email.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm font-bold">{user.full_name || 'N/A'}</p>
                            <p className="text-[10px] text-white/40">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-6">
                        <span className="px-2 py-1 rounded bg-yellow-500/10 text-yellow-500 text-[10px] font-bold border border-yellow-500/20">
                          {user.role}
                        </span>
                      </td>
                      <td className="p-6">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${user.status === 'active' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                          {user.status === 'active' ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                          {user.status}
                        </span>
                      </td>
                      <td className="p-6 text-xs text-white/40">
                        {new Date(user.created_at).toLocaleDateString('vi-VN')}
                      </td>
                      <td className="p-6 text-right">
                        <div className="flex justify-end gap-2">
                          {user.status === 'active' ? (
                            <button 
                              onClick={() => handleUpdateStatus(user.id, 'banned')}
                              className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-500 transition-colors title='Chặn người dùng'"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          ) : (
                            <button 
                              onClick={() => handleUpdateStatus(user.id, 'active')}
                              className="p-2 rounded-lg bg-green-500/10 hover:bg-green-500/20 text-green-500 transition-colors title='Bỏ chặn'"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                          )}
                          <button className="p-2 rounded-lg hover:bg-white/10 transition-colors">
                            <MoreVertical className="w-4 h-4 text-white/30" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
              <div className="p-6 border-t border-white/5 flex justify-between items-center">
                <p className="text-xs text-white/40">
                  Hiển thị {users.length} trên {meta.total} người dùng
                </p>
                <div className="flex gap-2">
                  <button 
                    disabled={meta.page <= 1}
                    onClick={() => setMeta({...meta, page: meta.page - 1})}
                    className="p-2 rounded-xl bg-zinc-900 border border-white/10 disabled:opacity-30"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button 
                    disabled={meta.page >= meta.totalPages}
                    onClick={() => setMeta({...meta, page: meta.page + 1})}
                    className="p-2 rounded-xl bg-zinc-900 border border-white/10 disabled:opacity-30"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
