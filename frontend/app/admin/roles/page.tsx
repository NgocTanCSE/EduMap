"use client";
import React, { useState, useEffect } from 'react';
import { adminService } from '@/src/services/admin.service';
import { Shield, Search, Plus, Trash2, Edit2, ShieldAlert, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminRolesPage() {
  const [roles, setRoles] = useState<{ id: number; name: string; description: string }[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDesc, setNewRoleDesc] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchRoles();
  }, []);

  const fetchRoles = async () => {
    try {
      setLoading(true);
      const data = await adminService.getRoles();
      setRoles(data);
    } catch (error) {
      console.error('Error fetching roles:', error);
      toast.error('Không thể tải danh sách vai trò. Đảm bảo bạn có quyền Admin.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRole = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newRoleName.trim()) return;

      try {
          setSubmitting(true);
          const newRole = await adminService.createRole(newRoleName, newRoleDesc);
          toast.success('Tạo vai trò thành công');
          setRoles([...roles, newRole]);
          setShowModal(false);
          setNewRoleName('');
          setNewRoleDesc('');
      } catch (error: any) {
          toast.error(error.message || 'Lỗi khi tạo vai trò');
      } finally {
          setSubmitting(false);
      }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white p-8">
      {/* Modal Create Role */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-[#121215] border border-white/10 rounded-3xl p-8 max-w-md w-full shadow-2xl relative">
                <button onClick={() => setShowModal(false)} className="absolute top-6 right-6 text-white/40 hover:text-white">
                    <X className="w-5 h-5" />
                </button>
                <h3 className="text-2xl font-bold mb-2">Thêm vai trò mới</h3>
                <p className="text-sm text-white/40 mb-6">Định nghĩa nhóm quyền hạn mới cho hệ thống.</p>
                
                <form onSubmit={handleCreateRole} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-white/60 uppercase tracking-widest mb-2">Tên vai trò (Key) *</label>
                        <input 
                            type="text" 
                            required
                            value={newRoleName}
                            onChange={e => setNewRoleName(e.target.value)}
                            placeholder="VD: content_creator"
                            className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-yellow-500 outline-none" 
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-white/60 uppercase tracking-widest mb-2">Mô tả chi tiết</label>
                        <textarea 
                            rows={3}
                            value={newRoleDesc}
                            onChange={e => setNewRoleDesc(e.target.value)}
                            placeholder="Mô tả chức năng của vai trò này..."
                            className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-yellow-500 outline-none resize-none" 
                        />
                    </div>
                    
                    <button 
                        type="submit" 
                        disabled={submitting}
                        className="w-full py-4 mt-4 rounded-xl bg-yellow-600 hover:bg-yellow-500 text-black font-black transition-all shadow-lg shadow-yellow-600/20 disabled:opacity-50 flex justify-center items-center gap-2"
                    >
                        {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : null} LƯU VAI TRÒ
                    </button>
                </form>
            </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <ShieldAlert className="w-8 h-8 text-yellow-500" />
              Quản lý Vai trò
            </h1>
            <p className="text-white/40 text-sm">Định nghĩa các nhóm quyền hạn trong hệ thống EduMap.</p>
          </div>
          <button 
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-yellow-600 hover:bg-yellow-500 text-black font-bold transition-all shadow-lg shadow-yellow-600/20"
          >
            <Plus className="w-4 h-4" />
            Thêm vai trò mới
          </button>
        </div>

        {/* Roles Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
             <div className="col-span-full py-20 text-center flex justify-center">
                 <Loader2 className="w-10 h-10 text-yellow-500 animate-spin" />
             </div>
          ) : roles.length > 0 ? roles.map(role => (
            <div key={role.id} className="p-6 rounded-[32px] bg-zinc-900/50 border border-white/10 hover:border-yellow-500/50 transition-all group">
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 rounded-2xl bg-yellow-500/10 text-yellow-500">
                  <Shield className="w-6 h-6" />
                </div>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                   <button className="p-2 rounded-lg hover:bg-white/5 text-white/40 hover:text-white">
                      <Edit2 className="w-4 h-4" />
                   </button>
                   <button className="p-2 rounded-lg hover:bg-red-500/10 text-white/40 hover:text-red-500">
                      <Trash2 className="w-4 h-4" />
                   </button>
                </div>
              </div>
              <h3 className="text-xl font-bold mb-2">{role.name}</h3>
              <p className="text-sm text-white/40 leading-relaxed mb-6">
                {role.description || 'Chưa có mô tả cho vai trò này.'}
              </p>
              <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                 <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest">ID: {role.id}</span>
                 <button className="text-xs font-bold text-yellow-500 hover:underline">Chi tiết quyền hạn</button>
              </div>
            </div>
          )) : (
              <div className="col-span-full py-20 text-center text-white/40 border border-dashed border-white/10 rounded-3xl">
                  Chưa có dữ liệu vai trò.
              </div>
          )}
        </div>

        {/* Info Section */}
        <div className="p-6 rounded-3xl bg-zinc-900 border border-white/10 flex gap-6 items-center">
           <div className="p-4 bg-yellow-500/10 rounded-2xl shrink-0">
              <Shield className="w-8 h-8 text-yellow-500" />
           </div>
           <div>
              <h4 className="font-bold mb-1">Cơ chế RBAC (Role-Based Access Control)</h4>
              <p className="text-xs text-white/40 leading-relaxed max-w-2xl">
                Hệ thống sử dụng cơ chế phân quyền dựa trên vai trò. Mỗi vai trò được gán một tập hợp các quyền (permissions) cụ thể để truy cập vào các tài nguyên và chức năng khác nhau. Chỉ có Admin mới được phép thao tác ở màn hình này.
              </p>
           </div>
        </div>

      </div>
    </div>
  );
}
