'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { CalendarDays, ExternalLink, Loader2, RefreshCw } from 'lucide-react';
import { useBookmarks } from '@/src/hooks/useBookmarks';
import {
  dashboardService,
  type DashboardHistoryItem,
} from '@/reporting/services/dashboard.service';
import { BookmarkButton } from '@/components/ui/BookmarkButton';
import {
  bookmarkLabel,
  targetUrl,
  type Bookmark,
} from '@/src/services/bookmark.service';

const HISTORY_LABEL: Record<string, string> = {
  application: 'Việc làm đã ứng tuyển',
  registration: 'Sự kiện đã đăng ký',
  intern_application: 'Thực tập đã ứng tuyển',
  scholar_application: 'Học bổng đã nộp',
  summer_registration: 'Đăng ký mùa hè',
};

export type ActivityTab = 'saved' | 'history';

type Props = {
  activeTab: ActivityTab;
  onTabChange: (tab: ActivityTab) => void;
};

export function PersonalActivity({ activeTab, onTabChange }: Props) {
  const {
    bookmarks,
    loading: bmLoading,
    error: bmError,
    refresh: refreshBookmarks,
  } = useBookmarks();
  const [history, setHistory] = useState<DashboardHistoryItem[]>([]);
  const [histLoading, setHistLoading] = useState(true);
  const [histError, setHistError] = useState(false);

  const loadHistory = useCallback(async () => {
    setHistLoading(true);
    setHistError(false);
    try {
      const data = await dashboardService.getHistory();
      setHistory(Array.isArray(data) ? data : []);
    } catch {
      setHistory([]);
      setHistError(true);
    } finally {
      setHistLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  return (
    <div>
      <div className="flex gap-1 overflow-x-auto border-b border-border">
        <button
          type="button"
          onClick={() => onTabChange('saved')}
          className={`whitespace-nowrap px-3 py-2.5 text-sm font-medium transition-colors ${
            activeTab === 'saved'
              ? 'border-b-2 border-primary text-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Đã lưu
        </button>
        <button
          type="button"
          onClick={() => onTabChange('history')}
          className={`whitespace-nowrap px-3 py-2.5 text-sm font-medium transition-colors ${
            activeTab === 'history'
              ? 'border-b-2 border-primary text-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Lịch sử đăng ký / ứng tuyển
        </button>
      </div>

      {activeTab === 'saved' && (
        <div className="pt-4">
          {bmLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Đang tải...
            </div>
          ) : bmError ? (
            <div className="flex flex-col items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
              <p className="text-sm text-destructive">{bmError}</p>
              <button
                type="button"
                onClick={() => refreshBookmarks()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-muted"
              >
                <RefreshCw className="h-3 w-3" /> Thử lại
              </button>
            </div>
          ) : bookmarks.length === 0 ? (
            <p className="text-sm text-muted-foreground/60">
              Bạn chưa lưu mục nào. Nhấn tim ở thẻ chi tiết/bản ghi để lưu tại đây.
            </p>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border bg-background/40">
              {bookmarks.map((b: Bookmark) => {
                const url = targetUrl(b.target_type, b.target_id);
                return (
                  <li
                    key={`${b.target_type}:${b.target_id}`}
                    className="flex items-center justify-between gap-3 p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-foreground/90">
                        {b.title || b.target_id}
                      </p>
                      <p className="text-xs text-muted-foreground/60">
                        {bookmarkLabel(b.target_type)} ·{' '}
                        <CalendarDays className="inline h-3 w-3" />
                        {new Date(b.created_at).toLocaleDateString('vi-VN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
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
        </div>
      )}

      {activeTab === 'history' && (
        <div className="pt-4">
          {histLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Đang tải...
            </div>
          ) : histError ? (
            <div className="flex flex-col items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
              <p className="text-sm text-destructive">
                Không thể tải lịch sử đăng ký / ứng tuyển.
              </p>
              <button
                type="button"
                onClick={loadHistory}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-muted"
              >
                <RefreshCw className="h-3 w-3" /> Thử lại
              </button>
            </div>
          ) : history.length === 0 ? (
            <p className="text-sm text-muted-foreground/60">
              Chưa có lịch sử đăng ký hay ứng tuyển nào.
            </p>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border bg-background/40">
              {history.map((h: DashboardHistoryItem, i: number) => (
                <li
                  key={`${h.type}:${h.title ?? i}`}
                  className="flex items-center justify-between gap-3 p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-foreground/90">
                      {h.title || '---'}
                    </p>
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
        </div>
      )}
    </div>
  );
}
