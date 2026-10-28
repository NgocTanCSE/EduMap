"use client";
import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  BookMarked,
  Bookmark,
  Database,
  Download,
  ExternalLink,
  FileText,
  Info,
  Library,
  Loader2,
  Search,
  Video,
} from 'lucide-react';
import Link from 'next/link';
import { libraryService } from '@/src/services/library.service';
import { CardSkeleton } from '../../src/components/ui/Skeleton';
import { toast } from 'sonner';
import SectionHeader from '@/components/ui/SectionHeader';
import EmptyState from '@/components/ui/EmptyState';
import { BookmarkButton } from '@/components/ui/BookmarkButton';

/**
 * Library — search + grid of learning materials.
 *
 * UI sync notes (design-system pass):
 *  - Page frame is `page-shell` (same padding/rhythm as every other feature).
 *  - Cover art for materials without an image is a **vector** icon tile, not
 *    an `<img>` pointing at a placeholder SVG, and no emoji is used as icon.
 *  - Every card is `card-equal` (h-full flex-col) with a clamped title and a
 *    `card-footer` pinned to the bottom, so rows align even when titles wrap.
 */

const TYPE_LABEL: Record<string, string> = {
  video: 'Video',
  pdf: 'PDF',
  book: 'Sách',
  article: 'Bài viết',
};

export default function LibraryPage() {
  const [resources, setResources] = useState<any[]>([]);
  const [categories] = useState<string[]>(["Tất cả", "Programming", "Soft Skills", "Science", "Design"]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [activeTab, setActiveTab] = useState("Tất cả");
  const [searchQuery, setSearchQuery] = useState("");

  // Pagination
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // Track whether results are from OpenLibrary or local SQLite fallback
  const [isFallback, setIsFallback] = useState(false);
  const [totalResults, setTotalResults] = useState(0);

  useEffect(() => {
    fetchResources(1);
  }, [activeTab]);

  const fetchResources = async (pageNum: number) => {
    try {
      if (pageNum === 1) setLoading(true);
      else setLoadingMore(true);

      const response = await libraryService.searchMaterials(searchQuery, activeTab, undefined, pageNum, 12);
      // fetchWithAuth calls unwrapApiResponse which strips the outer { data: ... } wrapper,
      // so the response can be either:
      //   - { items: [...], meta: {...} }        (unwrapped — most common)
      //   - { data: { items: [...], meta: {...} } }  (wrapped — defensive)
      const resourcesData = response.data?.items || response.items || response;
      const meta = response.data?.meta || response.meta || {};

      if (pageNum === 1) {
        setResources(Array.isArray(resourcesData) ? resourcesData : []);
      } else {
        setResources(prev => [...prev, ...(Array.isArray(resourcesData) ? resourcesData : [])]);
      }

      // Determine if results are from local SQLite fallback (not OpenLibrary)
      const items = Array.isArray(resourcesData) ? resourcesData : [];
      const allFallback = items.length > 0 && items.every((it: any) => it.source === 'local-sqlite');
      setIsFallback(allFallback);
      setTotalResults(meta.total ?? items.length);

      setHasMore(meta.currentPage < meta.totalPages);
      setPage(pageNum);
    } catch (error: any) {
      console.error("Lỗi fetch library:", error);
      toast.error(error.message || 'Không tải được học liệu');
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

  const resetFilters = () => {
    setSearchQuery("");
    setActiveTab("Tất cả");
    fetchResources(1);
  };

  return (
    <main className="page-shell">
      <SectionHeader
        icon={Library}
        title="Thư viện học liệu"
        subtitle="Sách, video và tài liệu mở cho học sinh, sinh viên Biên Hoà."
        right={
          <Link
            href="/dashboard#da-luu"
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3.5 text-sm font-medium text-foreground/80 transition-colors hover:border-primary/40 hover:text-foreground"
          >
            <Bookmark className="h-4 w-4" /> Đã lưu
          </Link>
        }
      />

      {/* Search bar — flat surface, no glow/blur so it matches every other form */}
      <form onSubmit={handleSearch} className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40"
          />
          <input
            type="text"
            placeholder="Bạn muốn tìm tài liệu gì?"
            aria-label="Tìm tài liệu"
            className="w-full rounded-lg border border-input bg-card py-2.5 pl-10 pr-3 text-sm text-foreground placeholder:text-foreground/40 focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/20"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <button
          type="submit"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Tìm kiếm <ArrowRight className="h-4 w-4" />
        </button>
      </form>

      {/* Filter tabs — one chip style shared with /features */}
      <div className="flex flex-wrap items-center gap-2">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveTab(cat)}
            aria-pressed={activeTab === cat}
            className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              activeTab === cat
                ? 'border-primary/50 bg-primary/15 text-primary'
                : 'border-border bg-card text-foreground/60 hover:text-foreground'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Result count + fallback notice */}
      {!loading && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-foreground/60">
          <p>
            Hiển thị <strong className="text-foreground">{resources.length}</strong> /{' '}
            <strong className="text-foreground">{totalResults}</strong> kết quả
            {searchQuery && <span>, tìm kiếm: “<strong className="text-foreground">{searchQuery}</strong>”</span>}
            {activeTab !== 'Tất cả' && <span>, danh mục: <strong className="text-foreground">{activeTab}</strong></span>}
          </p>
          {isFallback && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <Info className="h-3.5 w-3.5" />
              Đang dùng dữ liệu cục bộ (OpenLibrary không khả dụng)
            </span>
          )}
        </div>
      )}

      {/* Resources grid */}
      {loading ? (
        <div className="card-grid-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : resources.length > 0 ? (
        <div className="card-grid-4">
          {resources.map(res => {
            const TypeIcon = res.type === 'video' ? Video : res.type === 'pdf' ? FileText : BookMarked;
            return (
              <div
                key={res.id}
                className="card-surface card-equal group overflow-hidden transition-colors hover:border-primary/50"
              >
                <div className="relative flex aspect-[16/10] shrink-0 items-center justify-center overflow-hidden bg-background">
                  {res.cover_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={res.cover_image_url}
                      alt={res.title}
                      className="h-full w-full object-cover opacity-80 transition-opacity group-hover:opacity-100"
                    />
                  ) : (
                    <TypeIcon
                      aria-hidden="true"
                      className="h-12 w-12 text-foreground/15"
                    />
                  )}
                  <span className="absolute left-3 top-3 rounded-full border border-primary/25 bg-background/80 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                    {TYPE_LABEL[res.type] || res.type || 'Tài liệu'}
                  </span>
                  <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full border border-border bg-background/80 px-2 py-0.5 text-[10px] font-semibold text-foreground/60">
                    {res.source === 'open-library' ? (
                      <><Library className="h-3 w-3" /> OpenLibrary</>
                    ) : (
                      <><Database className="h-3 w-3" /> Cục bộ</>
                    )}
                  </span>
                </div>

                <div className="flex flex-1 flex-col p-4">
                  <div className="absolute top-3 right-3 z-20">
                    <BookmarkButton targetType="library" targetId={res.id} size="sm" />
                  </div>
                  <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-foreground transition-colors group-hover:text-primary">
                    {res.title}
                  </h3>
                  <p className="mt-1 line-clamp-1 text-xs text-foreground/55">
                    {res.author || 'EduMap Library'}
                  </p>

                  <div className="card-footer">
                    <span className="text-xs text-foreground/50">
                      {res.view_count ?? 0} lượt xem
                    </span>
                    <div className="flex items-center gap-1">
                      {res.file_url ? (
                        <>
                          <a
                            href={res.file_url}
                            download
                            title="Tải xuống"
                            aria-label={`Tải xuống ${res.title}`}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background/60 text-foreground/60 transition-colors hover:bg-muted hover:text-foreground"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </a>
                          <a
                            href={res.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Mở tại nguồn"
                            aria-label={`Mở ${res.title} tại nguồn`}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background/60 text-foreground/60 transition-colors hover:bg-muted hover:text-foreground"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </>
                      ) : (
                        <span className="text-xs text-foreground/40">Chưa có liên kết</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card-surface border-dashed">
          <EmptyState
            icon={<BookMarked className="h-7 w-7 text-foreground/30" />}
            title="Không tìm thấy tài liệu phù hợp"
            description="Thử từ khoá ngắn hơn hoặc chọn danh mục khác."
            action={{ label: 'Xoá bộ lọc', onClick: resetFilters }}
          />
        </div>
      )}

      {hasMore && resources.length > 0 && !loading && (
        <div className="flex justify-center pt-2">
          <button
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:border-primary/40 disabled:opacity-50"
          >
            {loadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
            {loadingMore ? 'Đang tải…' : 'Tải thêm tài liệu'}
          </button>
        </div>
      )}
    </main>
  );
}
