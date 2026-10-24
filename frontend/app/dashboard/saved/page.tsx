'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Heart, History, Loader2, ExternalLink, CalendarDays } from 'lucide-react';
import { useAuth } from '@/src/contexts/AuthContext';
import { useBookmarks } from '@/src/hooks/useBookmarks';
import { dashboardService } from '@/reporting/services/dashboard.service';
import { BookmarkButton } from '@/components/ui/BookmarkButton';
import { bookmarkLabel, targetUrl, type Bookmark } from '@/src/services/bookmark.service';

type HistoryItem = { type: string; title: string | null; status: string; created_at: string };

const HISTORY_LABEL: Record<string, string> = {
  application: 'Việc làm đã ứng tuyển',
  registration: 'Sự kiện đã đăng ký',
  intern_application: 'Thực tập đã ứng tuyển',
  scholar_application: 'Học bổng đã nộp',
  summer_registration: 'Đăng ký mùa hè',
};

export default function SavedPage() {
  const { user, isLoggedIn, loading: authLoading } = useAuth();
  const { bookmarks, loading: bmLoading, toggle } = useBookmarks();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [histLoading, setHistLoading] = useState(false);
  const [tab, setTab] = useState<'saved' | 'history'>('saved');

  useEffect(() => {
    if (!isLoggedIn) return;
    let cancelled = false;
    setHistLoading(true);
    dashboardService
      .getHistory()
      .then((data) => {
        if (!cancelled) setHistory(Array.isArray(data) ? data : []);
      })
      .catch(() => setHistory([]))
      .finally(() => !cancelled && setHistLoading(false));
    return () => {
      cancelled = true;
    };
  }, [isLoggedIn]);

  if (authLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isLoggedIn || !user) {
    return (
      <main className="w-full min-h-full px-6 py-10 md:px-8">
        <div className="mx-auto max-w-xl rounded-lg border border-border bg-card p-8 text-center shadow-sm">
          <Heart className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <h1 className="mt-4 text-2xl font-semibold">Chưa đăng nhập</h1>
          <p className="mt-2 text-sm text-muted-foreground/70">
            Đăng nhập để xem dan sách mục đã lưu và lịch sử hoạt động của bạn.
          </p>
          <Link
            href="/auth/login"
            className="mt-6 inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Đăng nhập
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="w-full min-h-full px-6 py-8 md:px-8 space-y-6">
      <div className="flex items-center gap-4 border-b border-border pb-3">
        <History className="h-5 w-5 text-primary" />
        <h1 className="text-2xl font-semibold">Hoạt động của tôi</h1>
      </div>

      {/* Tabs (simple, no extra dep) */}
      <div className="flex gap-2 border-b border-border">
        <button
          onClick={() => setTab('saved')}
          className={`rounded-t-lg px-4 py-2 text-sm font-medium ${
            tab === 'saved'
              ? 'border-b-2 border-primary text-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Đã lưu
        </button>
        <button
          onClick={() => setTab('history')}
          className={`rounded-t-lg px-4 py-2 text-sm font-medium ${
            tab === 'history'
              ? 'border-b-2 border-primary text-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Lịch sử đăng ký / ứng tuyển
        </button>
      </div>

      {/* ===== Đã lưu ===== */}
      {tab === 'saved' && (
        <section>
          {bmLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Đang tải...
            </div>
          ) : bookmarks.length === 0 ? (
            <p className="text-sm text-muted-foreground/60">
              Bạn chưa lưu mục nào. Nhấn tim ở thẻ chi tiết/bản ghi để lưu tại đây.
            </p>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border bg-card">
              {bookmarks.map((b: Bookmark) => {
                const url = targetUrl(b.target_type, b.target_id);
                return (
                  <li key={`${b.target_type}:${b.target_id}`} className="flex items-center justify-between gap-3 p-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground/90 truncate">
                        {b.title || b.target_id}
                      </p>
                      <p className="text-xs text-muted-foreground/60">
                        {bookmarkLabel(b.target_type)} ·{' '}
                        <CalendarDays className="inline h-3 w-3" />
                        {new Date(b.created_at).toLocaleDateString('vi-VN', {
                          day: '2-digit', month: 'short', year: 'numeric',
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {url && (
                        <Link
                          href={url}
                          className="rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
                        >
                          <ExternalLink className="inline h-3 w-3" /> Xem
                        </Link>
                      )}
                      <BookmarkButton
                        targetType={b.target_type}
                        targetId={b.target_id}
                        size="md"
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {/* ===== Lịch sử ===== */}
      {tab === 'history' && (
        <section>
          {histLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Đang tải...
            </div>
          ) : history.length === 0 ? (
            <p className="text-sm text-muted-foreground/60">
              Chưa có lịch sử đăng ký hay ứng tuyển nào.
            </p>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border bg-card">
              {history.map((h: HistoryItem, i: number) => (
                <li key={`${h.type}:${h.title ?? i}`} className="flex items-center justify-between gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground/90 truncate">{h.title || '---'}</p>
                    <p className="text-xs text-muted-foreground/60">
                      {HISTORY_LABEL[h.type] || h.type} · trạng thái: {h.status}
                    </p>
                  </div>
                  <CalendarDays className="h-4 w-4 text-muted-foreground/50" />
                  <span className="text-xs text-muted-foreground/60">
                    {new Date(h.created_at).toLocaleDateString('vi-VN')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </main>
  );
}
