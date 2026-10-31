import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
  totalItems?: number;
  pageSize?: number;
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  className = '',
  totalItems,
  pageSize,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const getPageNumbers = () => {
    const pages: number[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) pages.push(i);
        pages.push(-1);
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push(-1);
        for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push(-1);
        for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
        pages.push(-1);
        pages.push(totalPages);
      }
    }
    return pages;
  };

  return (
    <div className={`flex flex-col sm:flex-row items-center justify-between gap-3 pt-6 border-t border-border/60 ${className}`}>
      <div className="text-xs text-muted-foreground font-medium">
        {totalItems !== undefined && pageSize !== undefined ? (
          <span>
            Hiển thị <strong className="text-foreground">{Math.min(totalItems, (currentPage - 1) * pageSize + 1)}</strong> -{" "}
            <strong className="text-foreground">{Math.min(totalItems, currentPage * pageSize)}</strong> /{" "}
            <strong className="text-foreground">{totalItems}</strong> mục
          </span>
        ) : (
          <span>
            Trang <strong className="text-foreground">{currentPage}</strong> /{" "}
            <strong className="text-foreground">{totalPages}</strong>
          </span>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          aria-label="Trang trước"
          className="inline-flex h-9 items-center justify-center gap-1 rounded-xl border border-border/80 bg-card px-3 text-xs font-semibold text-foreground shadow-xs transition-all hover:bg-secondary disabled:opacity-40 disabled:pointer-events-none"
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Trước</span>
        </button>

        {getPageNumbers().map((page, idx) =>
          page === -1 ? (
            <span key={`ellipsis-${idx}`} className="px-2 text-xs font-bold text-muted-foreground">
              ...
            </span>
          ) : (
            <button
              key={page}
              type="button"
              onClick={() => onPageChange(page)}
              className={`h-9 min-w-[36px] px-2.5 rounded-xl text-xs font-bold transition-all shadow-xs ${
                currentPage === page
                  ? 'bg-foreground text-background font-extrabold shadow-sm'
                  : 'bg-card border border-border/70 text-foreground hover:bg-secondary'
              }`}
            >
              {page}
            </button>
          )
        )}

        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          aria-label="Trang sau"
          className="inline-flex h-9 items-center justify-center gap-1 rounded-xl border border-border/80 bg-card px-3 text-xs font-semibold text-foreground shadow-xs transition-all hover:bg-secondary disabled:opacity-40 disabled:pointer-events-none"
        >
          <span className="hidden sm:inline">Sau</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default Pagination;
