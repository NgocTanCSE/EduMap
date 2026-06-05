"use client";
import React, { useEffect, useState } from 'react';
import { BookOpen, MapPin, Search, Filter, Loader2, Share2, Plus, MessageSquare, Box } from 'lucide-react';
import { shareService, SharedItem } from '@/src/services/share.service';
import { authService } from '@/src/services/auth.service';
import { toast } from 'sonner';

export default function ShareMarketplacePage() {
  const [items, setItems] = useState<SharedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('');

  // Modals
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareForm, setShareForm] = useState({ name: '', description: '', category: 'book' });
  const [sharing, setSharing] = useState(false);

  const [showRequestModal, setShowRequestModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<SharedItem | null>(null);
  const [requestMessage, setRequestMessage] = useState('');
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    fetchItems();
  }, [activeCategory]);

  const fetchItems = async () => {
    try {
      setLoading(true);
      const data = await shareService.getItems(activeCategory || undefined);
      setItems(data);
    } catch (error: any) {
      toast.error('Không thể tải danh sách tài liệu');
    } finally {
      setLoading(false);
    }
  };

  const handleShareSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!authService.isLoggedIn()) {
          toast.error('Vui lòng đăng nhập để chia sẻ');
          return;
      }
      if (!shareForm.name.trim()) return;

      try {
          setSharing(true);
          await shareService.createItem(shareForm.name, shareForm.description, shareForm.category);
          toast.success('Đã chia sẻ tài liệu thành công!');
          setShowShareModal(false);
          setShareForm({ name: '', description: '', category: 'book' });
          fetchItems(); // Refresh
      } catch (error: any) {
          toast.error(error.message || 'Lỗi khi chia sẻ');
      } finally {
          setSharing(false);
      }
  };

  const openRequestModal = (item: SharedItem) => {
      if (!authService.isLoggedIn()) {
          toast.error('Vui lòng đăng nhập để mượn');
          window.location.href = '/auth/login?redirect=/marketplace';
          return;
      }
      setSelectedItem(item);
      setShowRequestModal(true);
  };

  const handleRequestSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedItem) return;

      try {
          setRequesting(true);
          const result = await shareService.requestItem(selectedItem.id, requestMessage);
          toast.success(result.message || 'Đã gửi yêu cầu mượn!');
          setShowRequestModal(false);
          setRequestMessage('');
      } catch (error: any) {
          toast.error(error.message || 'Lỗi khi mượn');
      } finally {
          setRequesting(false);
      }
  };

  const filteredItems = items.filter(i => 
      i.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      i.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#050505] text-white p-8">
      
      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-[#121215] border border-white/10 rounded-3xl p-8 max-w-md w-full shadow-2xl relative">
                <button onClick={() => setShowShareModal(false)} className="absolute top-6 right-6 text-white/40 hover:text-white">X</button>
                <h3 className="text-2xl font-bold mb-2 flex items-center gap-2"><Share2 className="text-pink-500 w-6 h-6"/> Chia sẻ tài liệu</h3>
                <p className="text-sm text-white/40 mb-6">Đóng góp sách hoặc học cụ của bạn cho cộng đồng.</p>
                
                <form onSubmit={handleShareSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-white/60 uppercase tracking-widest mb-2">Tên tài liệu / Học cụ *</label>
                        <input 
                            type="text" 
                            required
                            value={shareForm.name}
                            onChange={e => setShareForm({...shareForm, name: e.target.value})}
                            placeholder="VD: Sách Toán Cao Cấp Tập 1"
                            className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-pink-500 outline-none" 
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-white/60 uppercase tracking-widest mb-2">Phân loại</label>
                        <select 
                            value={shareForm.category}
                            onChange={e => setShareForm({...shareForm, category: e.target.value})}
                            className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-pink-500 outline-none appearance-none" 
                        >
                            <option value="book">Sách & Giáo trình</option>
                            <option value="tool">Dụng cụ học tập</option>
                            <option value="electronic">Thiết bị điện tử</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-white/60 uppercase tracking-widest mb-2">Tình trạng & Mô tả</label>
                        <textarea 
                            rows={3}
                            value={shareForm.description}
                            onChange={e => setShareForm({...shareForm, description: e.target.value})}
                            placeholder="VD: Sách còn mới 90%, không rách trang nào..."
                            className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-pink-500 outline-none resize-none" 
                        />
                    </div>
                    
                    <button 
                        type="submit" 
                        disabled={sharing}
                        className="w-full py-4 mt-4 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-bold transition-all shadow-lg shadow-pink-600/20 disabled:opacity-50 flex justify-center items-center gap-2"
                    >
                        {sharing ? <Loader2 className="w-5 h-5 animate-spin" /> : null} ĐĂNG TÀI LIỆU
                    </button>
                </form>
            </div>
        </div>
      )}

      {/* Request Modal */}
      {showRequestModal && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-[#121215] border border-white/10 rounded-3xl p-8 max-w-md w-full shadow-2xl relative">
                <button onClick={() => setShowRequestModal(false)} className="absolute top-6 right-6 text-white/40 hover:text-white">X</button>
                <h3 className="text-2xl font-bold mb-2">Mượn tài liệu</h3>
                <p className="text-sm text-pink-400 font-bold mb-6">{selectedItem.name}</p>
                
                <form onSubmit={handleRequestSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-white/60 uppercase tracking-widest mb-2 flex items-center gap-2"><MessageSquare className="w-4 h-4"/> Lời nhắn gửi đến {selectedItem.owner?.full_name}</label>
                        <textarea 
                            required
                            rows={4}
                            value={requestMessage}
                            onChange={e => setRequestMessage(e.target.value)}
                            placeholder="Chào bạn, mình đang rất cần tài liệu này để ôn thi. Cho mình mượn nhé!"
                            className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-blue-500 outline-none resize-none" 
                        />
                    </div>
                    
                    <button 
                        type="submit" 
                        disabled={requesting}
                        className="w-full py-4 mt-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition-all shadow-lg shadow-blue-600/20 disabled:opacity-50 flex justify-center items-center gap-2"
                    >
                        {requesting ? <Loader2 className="w-5 h-5 animate-spin" /> : null} GỬI YÊU CẦU MƯỢN
                    </button>
                </form>
            </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-end gap-6 bg-gradient-to-br from-pink-600/20 to-orange-600/10 p-12 rounded-[40px] border border-white/5 relative overflow-hidden">
          <div className="relative z-10">
            <h1 className="text-4xl font-black mb-4">Góc Chia Sẻ & Trao Đổi</h1>
            <p className="text-white/60 max-w-md leading-relaxed">
              Mua bán, trao đổi sách cũ, giáo trình và đồ dùng học tập từ cộng đồng học sinh, sinh viên EduMap.
            </p>
          </div>
          <div className="relative z-10">
            <button 
                onClick={() => setShowShareModal(true)}
                className="px-8 py-4 bg-pink-600 hover:bg-pink-500 rounded-2xl font-bold flex items-center gap-2 shadow-xl shadow-pink-600/20 transition-all"
            >
                <Plus className="w-5 h-5" /> ĐĂNG TÀI LIỆU MỚI
            </button>
          </div>
          <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
            <Box className="w-64 h-64" />
          </div>
        </div>

        {/* Search & Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
            <input 
              type="text" 
              placeholder="Tìm kiếm sách, học cụ..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-zinc-900 border border-white/10 rounded-2xl py-4 pl-12 pr-4 outline-none focus:border-pink-500 transition-colors" 
            />
          </div>
          <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-2 sm:pb-0">
            {[
                { id: '', label: 'Tất cả' },
                { id: 'book', label: 'Sách & Giáo trình' },
                { id: 'tool', label: 'Dụng cụ' },
                { id: 'electronic', label: 'Điện tử' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveCategory(tab.id)}
                className={`px-6 py-4 rounded-2xl border text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
                  activeCategory === tab.id 
                    ? 'bg-pink-600 border-pink-500 text-white' 
                    : 'bg-card border-white/10 text-white/60 hover:bg-white/5'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Items List */}
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 text-pink-500 animate-spin" /></div>
        ) : filteredItems.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredItems.map(item => (
              <div key={item.id} className="p-6 rounded-3xl bg-card border border-white/10 flex flex-col h-full hover:border-pink-500/30 transition-colors group">
                <div className="flex items-center gap-3 mb-4">
                    <img src={item.owner?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.owner?.full_name || 'U')}&background=random`} alt="" className="w-10 h-10 rounded-full border border-white/10"/>
                    <div>
                        <p className="text-sm font-bold text-gray-200">{item.owner?.full_name}</p>
                        <p className="text-[10px] text-white/40">{new Date(item.created_at).toLocaleDateString('vi-VN')}</p>
                    </div>
                </div>

                <div className="flex-1">
                    <span className="inline-block px-2 py-1 bg-white/5 rounded border border-white/10 text-[10px] uppercase font-bold text-white/60 tracking-widest mb-2">
                        {item.category === 'book' ? 'SÁCH' : item.category === 'tool' ? 'DỤNG CỤ' : 'ĐIỆN TỬ'}
                    </span>
                    <h3 className="text-lg font-bold mb-2 group-hover:text-pink-400 transition-colors line-clamp-2">{item.name}</h3>
                    <p className="text-sm text-white/60 line-clamp-3 leading-relaxed">
                        {item.description}
                    </p>
                </div>

                <div className="pt-6 mt-6 border-t border-white/5 flex gap-3">
                    <button 
                        onClick={() => openRequestModal(item)}
                        className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-blue-600/20"
                    >
                        MƯỢN TÀI LIỆU
                    </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
            <div className="text-center py-20 bg-card border border-dashed border-white/10 rounded-[40px]">
                <BookOpen className="w-12 h-12 text-white/10 mx-auto mb-4" />
                <p className="text-white/40">Chưa có tài liệu nào trong chuyên mục này.</p>
            </div>
        )}

      </div>
    </div>
  );
}
