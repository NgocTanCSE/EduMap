"use client";
import React, { useEffect, useState } from 'react';
import { BookOpen, Search, Loader2, Share2, Plus, MessageSquare, Box } from 'lucide-react';
import { shareService, SharedItem } from '@/src/services/share.service';
import { authService } from '@/src/services/auth.service';
import { toast } from 'sonner';
import Thumb from '@/components/ui/Thumb';
import { avatarFallback, marketplaceIllustration, onImageError } from '@/src/lib/illustrations';
import { MarketplaceNav } from '@/components/marketplace/MarketplaceNav';

export default function ShareMarketplacePage() {
  const [items, setItems] = useState<SharedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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

  // `/marketplace/books` redirects here with `?category=book`, so the books
  // filter is deep-linkable instead of living on a separate duplicate page.
  // Adopt the URL filter on the first render without firing an extra request
  // for the unfiltered list first.
  useEffect(() => {
    const initial = new URLSearchParams(window.location.search).get('category') || '';
    if (activeCategory === '' && ['book', 'tool', 'electronic'].includes(initial)) {
      setActiveCategory(initial);
      return;
    }
    fetchItems();
  }, [activeCategory]);

  const fetchItems = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await shareService.getItems(activeCategory || undefined);
      setItems((data as any).data || (Array.isArray(data) ? data : []) || []);
    } catch (err: any) {
      setError(err?.message || 'Không thể tải danh sách tài liệu.');
      toast.error('Không thể tải danh sách tài liệu');
    } finally {
      setLoading(false);
    }
  };

  const selectCategory = (category: string) => {
    setActiveCategory(category);
    const url = new URL(window.location.href);
    if (category) url.searchParams.set('category', category);
    else url.searchParams.delete('category');
    window.history.replaceState(null, '', url.toString());
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

  const filteredItems = items.filter((item) => {
      const needle = searchTerm.trim().toLowerCase();
      if (!needle) return true;
      return [item.name, item.description, item.owner?.full_name]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle));
  });

  return (
    <div className="min-h-screen bg-background text-foreground px-4 py-6 sm:px-6 sm:py-8">
      
      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 animate-in fade-in">
            <div className="bg-card border border-border rounded-xl p-8 max-w-md w-full relative">
                <button onClick={() => setShowShareModal(false)} className="absolute top-6 right-6 text-muted-foreground/60 hover:text-foreground">X</button>
                <h3 className="text-2xl font-bold mb-2 flex items-center gap-2"><Share2 className="text-primary w-6 h-6"/> Chia sẻ tài liệu</h3>
                <p className="text-sm text-muted-foreground/60 mb-6">Đóng góp sách hoặc học cụ của bạn cho cộng đồng.</p>
                
                <form onSubmit={handleShareSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-muted-foreground/60 uppercase tracking-widest mb-2">Tên tài liệu / Học cụ *</label>
                        <input 
                            type="text" 
                            required
                            value={shareForm.name}
                            onChange={e => setShareForm({...shareForm, name: e.target.value})}
                            placeholder="VD: Sách Toán Cao Cấp Tập 1"
                            className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm focus:border-primary outline-none" 
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-muted-foreground/60 uppercase tracking-widest mb-2">Phân loại</label>
                        <select 
                            value={shareForm.category}
                            onChange={e => setShareForm({...shareForm, category: e.target.value})}
                            className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm focus:border-primary outline-none appearance-none" 
                        >
                            <option value="book">Sách & Giáo trình</option>
                            <option value="tool">Dụng cụ học tập</option>
                            <option value="electronic">Thiết bị điện tử</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-muted-foreground/60 uppercase tracking-widest mb-2">Tình trạng & Mô tả</label>
                        <textarea 
                            rows={3}
                            value={shareForm.description}
                            onChange={e => setShareForm({...shareForm, description: e.target.value})}
                            placeholder="VD: Sách còn mới 90%, không rách trang nào..."
                            className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm focus:border-primary outline-none resize-none" 
                        />
                    </div>
                    
                    <button 
                        type="submit" 
                        disabled={sharing}
                        className="w-full py-4 mt-4 rounded-xl bg-primary hover:bg-primary text-foreground font-bold transition-all shadow-lg shadow-pink-600/20 disabled:opacity-50 flex justify-center items-center gap-2"
                    >
                        {sharing ? <Loader2 className="w-5 h-5 animate-spin" /> : null} ĐĂNG TÀI LIỆU
                    </button>
                </form>
            </div>
        </div>
      )}

      {/* Request Modal */}
      {showRequestModal && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 animate-in fade-in">
            <div className="bg-card border border-border rounded-xl p-8 max-w-md w-full relative">
                <button onClick={() => setShowRequestModal(false)} className="absolute top-6 right-6 text-muted-foreground/60 hover:text-foreground">X</button>
                <h3 className="text-2xl font-bold mb-2">Mượn tài liệu</h3>
                <p className="text-sm text-primary font-bold mb-6">{selectedItem.name}</p>
                
                <form onSubmit={handleRequestSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-muted-foreground/60 uppercase tracking-widest mb-2 flex items-center gap-2"><MessageSquare className="w-4 h-4"/> Lời nhắn gửi đến {selectedItem.owner?.full_name}</label>
                        <textarea 
                            required
                            rows={4}
                            value={requestMessage}
                            onChange={e => setRequestMessage(e.target.value)}
                            placeholder="Chào bạn, mình đang rất cần tài liệu này để ôn thi. Cho mình mượn nhé!"
                            className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm focus:border-primary outline-none resize-none" 
                        />
                    </div>
                    
                    <button 
                        type="submit" 
                        disabled={requesting}
                        className="w-full py-4 mt-4 rounded-xl bg-primary hover:bg-primary text-primary-foreground font-bold transition-all shadow-lg disabled:opacity-50 flex justify-center items-center gap-2"
                    >
                        {requesting ? <Loader2 className="w-5 h-5 animate-spin" /> : null} GỬI YÊU CẦU MƯỢN
                    </button>
                </form>
            </div>
        </div>
      )}

      <div className="w-full mx-auto space-y-8">
        <MarketplaceNav />

        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-end gap-6 bg-card p-6 rounded-lg border border-border relative overflow-hidden">
          <div className="relative z-10">
            <h1 className="text-2xl font-semibold mb-4">Góc Chia Sẻ & Trao Đổi</h1>
            <p className="text-muted-foreground/60 max-w-md leading-relaxed">
              Mua bán, trao đổi sách cũ, giáo trình và đồ dùng học tập từ cộng đồng học sinh, sinh viên EduMap.
            </p>
          </div>
          <div className="relative z-10">
            <button 
                onClick={() => setShowShareModal(true)}
                className="px-8 py-4 bg-primary hover:bg-primary rounded-lg font-bold flex items-center gap-2 shadow-pink-600/20 transition-all"
            >
                <Plus className="w-5 h-5" /> ĐĂNG TÀI LIỆU MỚI
            </button>
          </div>
          <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none">
            <Box className="w-24 h-24" />
          </div>
        </div>

        {/* Search & Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground/45" />
            <input 
              type="search"
              placeholder="Tìm kiếm sách, học cụ..."
              aria-label="Tìm kiếm tài liệu chia sẻ"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-card border border-border rounded-lg py-4 pl-12 pr-4 outline-none focus:border-primary transition-colors" 
            />
          </div>
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2 sm:pb-0">
            {[
                { id: '', label: 'Tất cả' },
                { id: 'book', label: 'Sách & Giáo trình' },
                { id: 'tool', label: 'Dụng cụ' },
                { id: 'electronic', label: 'Điện tử' }
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                aria-pressed={activeCategory === tab.id}
                onClick={() => selectCategory(tab.id)}
                className={`px-6 py-4 rounded-lg border text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
                  activeCategory === tab.id 
                    ? 'bg-primary border-primary text-primary-foreground' 
                    : 'bg-card border-border text-muted-foreground/60 hover:bg-card/20'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Items List */}
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-10 h-10 text-primary animate-spin" /></div>
        ) : error ? (
          <div role="alert" className="text-center py-12 bg-card border border-destructive/30 rounded-lg">
            <p className="text-sm text-destructive">{error}</p>
            <button
              type="button"
              onClick={fetchItems}
              className="mt-4 px-5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/80 transition-colors"
            >
              Thử lại
            </button>
          </div>
        ) : filteredItems.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredItems.map(item => (
              <div key={item.id} className="relative p-6 rounded-xl bg-card border border-border flex flex-col h-full hover:border-primary/30 transition-colors group">
                <div className="-mx-6 -mt-6 mb-4 overflow-hidden rounded-t-xl border-b border-border">
                  <Thumb
                    src={marketplaceIllustration(item.category)}
                    alt={item.name}
                    aspect="16/7"
                    className="rounded-none"
                  />
                </div>
                <div className="flex items-center gap-3 mb-4">
                    <img src={item.owner?.avatar_url || avatarFallback(item.owner?.full_name)} onError={onImageError(avatarFallback(item.owner?.full_name))} alt="" className="w-10 h-10 rounded-full border border-border object-cover"/>
                    <div>
                        <p className="text-sm font-bold text-muted-foreground/70">{item.owner?.full_name}</p>
                        <p className="text-[10px] text-muted-foreground/60">{new Date(item.created_at).toLocaleDateString('vi-VN')}</p>
                    </div>
                </div>

                <div className="flex-1">
                    <span className="inline-block px-2 py-1 bg-card/20 rounded border border-border text-[10px] uppercase font-bold text-muted-foreground/60 tracking-widest mb-2">
                        {item.category === 'book' ? 'SÁCH' : item.category === 'tool' ? 'DỤNG CỤ' : 'ĐIỆN TỬ'}
                    </span>
                    <h3 className="text-lg font-bold mb-2 group-hover:text-primary transition-colors line-clamp-2">{item.name}</h3>
                    <p className="text-sm text-muted-foreground/60 line-clamp-3 leading-relaxed">
                        {item.description?.trim() || 'Người chia sẻ chưa thêm mô tả.'}
                    </p>
                </div>

                <div className="pt-6 mt-6 border-t border-border flex gap-3">
                    <button 
                        onClick={() => openRequestModal(item)}
                        className="flex-1 py-3 bg-primary hover:bg-primary text-primary-foreground rounded-xl text-xs font-bold transition-all shadow-lg"
                    >
                        MƯỢN TÀI LIỆU
                    </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
            <div className="text-center py-12 bg-card border border-dashed border-border rounded-lg">
                <BookOpen className="w-12 h-12 text-muted-foreground/10 mx-auto mb-4" />
                <p className="text-muted-foreground/60">
                  {searchTerm.trim()
                    ? 'Không tìm thấy tài liệu phù hợp với từ khóa.'
                    : 'Chưa có tài liệu nào trong chuyên mục này.'}
                </p>
                {searchTerm.trim() && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="mt-4 text-sm font-semibold text-primary hover:underline"
                  >
                    Xóa từ khóa
                  </button>
                )}
            </div>
        )}

      </div>
    </div>
  );
}
