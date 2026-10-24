"use client";
import React, { useEffect, useState } from 'react';
import { ILLUSTRATIONS, onImageError } from '@/src/lib/illustrations';
import {
  Search, Filter, Book, Video, FileText,
  Download, ExternalLink, Bookmark, Sparkles,
  ArrowRight, Star, Loader2
} from 'lucide-react';
import Link from 'next/link';
import { libraryService } from '@/src/services/library.service';
import { CardSkeleton } from '../../src/components/ui/Skeleton';
import { toast } from 'sonner';

export default function LibraryPage() {
  const [resources, setResources] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>(["Tất cả", "Programming", "Soft Skills", "Science", "Design"]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [activeTab, setActiveTab] = useState("Tất cả");
  const [searchQuery, setSearchQuery] = useState("");

  // Pagination
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    fetchResources(1);
  }, [activeTab]);

  const fetchInitialData = async () => {
    try {
      // In a real scenario, we might fetch dynamic categories from an API
      // const dynamicCategories = await libraryService.getCategories();
      // setCategories(["Tất cả", ...dynamicCategories]);
    } catch (error) {
      console.error("Lỗi fetch categories:", error);
    }
  };

  const fetchResources = async (pageNum: number) => {
    try {
      if (pageNum === 1) setLoading(true);
      else setLoadingMore(true);

      const response = await libraryService.searchMaterials(searchQuery, activeTab, undefined, pageNum, 12);
      const resourcesData = response.data?.items || response.data || response;
      const meta = response.data?.meta || {};

      if (pageNum === 1) {
        setResources(Array.isArray(resourcesData) ? resourcesData : []);
      } else {
        setResources(prev => [...prev, ...(Array.isArray(resourcesData) ? resourcesData : [])]);
      }

      setHasMore(meta.currentPage < meta.totalPages);
      setPage(pageNum);
    } catch (error: any) {
      console.error("Lỗi fetch library:", error);
      toast.error(error.message || 'Failed to load library resources');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      fetchResources(page + 1);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchResources(1);
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-8 relative">
      <div className="w-full">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
          <div>
            <h1 className="text-2xl font-bold mb-2">Thư viện học liệu</h1>
            <p className="text-muted-foreground font-medium">Khám phá hàng ngàn tài liệu chất lượng cao</p>
          </div>
          <div className="flex gap-3">
            {/* "Đã lưu" → mở tab Đã lưu trong mục Hoạt động của tôi ở dashboard */}
            <Link
              href="/dashboard#da-luu"
              className="bg-card border border-border px-4 py-2 rounded-xl flex items-center gap-2 text-sm hover:bg-card transition-all"
            >
              <Bookmark className="w-4 h-4" /> Đã lưu
            </Link>
          </div>
        </div>

        {/* AI Search Bar */}
        <form onSubmit={handleSearch} className="relative mb-12 group">
          <div className="absolute -inset-1 bg-primary rounded-lg blur opacity-20 group-focus-within:opacity-40 transition duration-1000"></div>
          <div className="relative bg-card/80 border border-border rounded-lg p-2 flex items-center gap-2">
            <div className="pl-4 pr-2"><Sparkles className="w-6 h-6 text-primary" /></div>
            <input
              type="text"
              placeholder="Bạn muốn tìm tài liệu gì?..."
              className="flex-1 bg-transparent py-4 text-lg focus:outline-none placeholder:text-gray-600 text-primary"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button type="submit" className="bg-primary text-white px-8 py-4 rounded-xl font-bold hover:bg-yellow-700 transition-all flex items-center gap-2">
              Tìm kiếm AI <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </form>

        {/* Filter Tabs */}
        <div className="flex flex-wrap items-center gap-3 mb-8">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveTab(cat)}
              className={`px-6 py-2.5 rounded-full text-sm font-bold transition-all border ${
                activeTab === cat
                ? 'bg-primary border-primary text-white shadow-lg'
                : 'bg-card border-border text-muted-foreground/40 hover:border-border'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Resources Grid — mỗi thẻ có sẵn 2 nút: Tải xuống + Xem chi tiết (mở link gốc đọc sách).
            Không còn popup modal "bảng General" / tóm tắt AI (AI đang lỗi 503 trên HF). */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
              <CardSkeleton key={i} />
            ))}
          </div>
        ) : resources.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {resources.map(res => (
              <div
                key={res.id}
                className="bg-card border border-border rounded-xl overflow-hidden hover:border-primary/50 transition-all group flex flex-col h-full"
              >
                <div className={`h-48 bg-background flex items-center justify-center relative overflow-hidden shrink-0`}>
                  {res.cover_image_url ? (
                    <img src={res.cover_image_url} alt={res.title} onError={onImageError(ILLUSTRATIONS.learning)} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" />
                  ) : (
                    <>
                      <div className="absolute inset-0 bg-gradient-to-t from-background/70 to-transparent opacity-60"></div>
                      {res.type === "video" ? <Video className="w-16 h-16 text-muted-foreground/10 group-hover:scale-110 transition-transform duration-500" /> : <Book className="w-16 h-16 text-muted-foreground/10 group-hover:scale-110 transition-transform duration-500" />}
                    </>
                  )}
                  <div className="absolute top-4 left-4 bg-black/60 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider text-primary border border-primary/20">{res.type}</div>
                </div>
                <div className="p-6 flex flex-col flex-1">
                  <div className="flex items-center gap-1 text-amber-500 text-[10px] font-semibold mb-3 bg-amber-500/10 px-2 py-0.5 rounded-full w-max border border-amber-500/20 uppercase tracking-widest">
                    <Star className="w-3 h-3 fill-amber-400 text-amber-400" /> POPULAR
                  </div>
                  <h3 className="font-bold text-lg mb-1 group-hover:text-primary transition-colors line-clamp-2">{res.title}</h3>
                  <p className="text-muted-foreground text-sm mb-4 line-clamp-1">{res.author || 'EduMap Library'}</p>

                  {/* Hai nút: Tải xuống + Xem chi tiết (mở link gốc để đọc) */}
                  <div className="mt-auto pt-4 border-t border-border flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-muted-foreground">{res.view_count} views</span>
                    <div className="flex items-center gap-1">
                      {res.file_url ? (
                        <>
                          <a
                            href={res.file_url}
                            download
                            title="Tải xuống"
                            className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-border bg-background/60 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </a>
                          <a
                            href={res.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Xem chi tiết — mở tại nguồn"
                            className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-border bg-background/60 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground/50">Chưa có link</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-xl">
              Không tìm thấy tài liệu phù hợp.
          </div>
        )}

        {hasMore && resources.length > 0 && !loading && (
          <div className="flex justify-center mt-12">
            <button
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="px-8 py-3 rounded-full border border-border text-foreground hover:bg-card/20 text-sm font-bold flex items-center gap-2 transition-all disabled:opacity-50"
            >
              {loadingMore ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {loadingMore ? 'Đang tải...' : 'Tải thêm tài liệu'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
