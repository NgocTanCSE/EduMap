"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Layers, Search, X } from "lucide-react";
import SectionHeader from "@/components/ui/SectionHeader";
import EmptyState from "@/components/ui/EmptyState";
import {
  FEATURES,
  FEATURE_GROUPS,
  matchesFeature,
  type FeatureGroupId,
} from "@/src/lib/feature-catalog";

/**
 * /features — the single discovery hub for every EduMap feature.
 *
 * Why this page exists (anti-fragmentation):
 *   Feature discovery used to live only in the left sidebar, which can hold
 *   ~35 links before it becomes a wall of text. Several shipped pages were
 *   not in that list at all, so users could not find them without knowing
 *   the URL. The catalog (`src/lib/feature-catalog.ts`) is now the source of
 *   truth and this page renders all of it, grouped and searchable.
 *
 * The card grid is intentionally uniform: every card is the same height
 * (`h-full flex flex-col`), title and description are line-clamped, and the
 * "Mở" footer is pushed to the bottom with `mt-auto`, so text boxes line up
 * across a row regardless of description length.
 */

const ALL_GROUPS = "all" as const;
type GroupFilter = typeof ALL_GROUPS | FeatureGroupId;

export default function FeaturesHubPage() {
  const [query, setQuery] = useState("");
  const [activeGroup, setActiveGroup] = useState<GroupFilter>(ALL_GROUPS);

  const filtered = useMemo(
    () =>
      FEATURES.filter(
        (feature) =>
          (activeGroup === ALL_GROUPS || feature.group === activeGroup) &&
          matchesFeature(feature, query),
      ),
    [query, activeGroup],
  );

  const visibleGroups = useMemo(
    () =>
      FEATURE_GROUPS.map((group) => ({
        ...group,
        items: filtered.filter((feature) => feature.group === group.id),
      })).filter((group) => group.items.length > 0),
    [filtered],
  );

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      <SectionHeader
        icon={Layers}
        title="Tất cả tính năng"
        subtitle="Một danh mục duy nhất cho toàn bộ EduMap — tìm theo tên, mô tả hoặc nhóm."
        right={
          <span className="inline-flex items-center rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-foreground/70">
            {FEATURES.length} tính năng
          </span>
        }
      />

      {/* Search + group filter — one control row, aligned to the grid below */}
      <div className="space-y-3">
        <div className="relative">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tìm tính năng: học bổng, wifi, bản đồ, dịch thuật…"
            aria-label="Tìm tính năng"
            className="w-full rounded-lg border border-input bg-card py-2.5 pl-10 pr-10 text-sm text-foreground placeholder:text-foreground/40 focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Xoá từ khoá tìm kiếm"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-foreground/50 transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveGroup(ALL_GROUPS)}
            aria-pressed={activeGroup === ALL_GROUPS}
            className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              activeGroup === ALL_GROUPS
                ? "border-primary/50 bg-primary/15 text-primary"
                : "border-border bg-card text-foreground/60 hover:border-border hover:text-foreground"
            }`}
          >
            Tất cả ({FEATURES.length})
          </button>
          {FEATURE_GROUPS.map((group) => {
            const Icon = group.icon;
            const count = FEATURES.filter((f) => f.group === group.id).length;
            return (
              <button
                key={group.id}
                type="button"
                onClick={() => setActiveGroup(group.id)}
                aria-pressed={activeGroup === group.id}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                  activeGroup === group.id
                    ? "border-primary/50 bg-primary/15 text-primary"
                    : "border-border bg-card text-foreground/60 hover:text-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {group.label}
                <span className="text-foreground/40">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/40">
          <EmptyState
            icon={<Search className="h-7 w-7 text-foreground/30" />}
            title="Không tìm thấy tính năng phù hợp"
            description={`Không có kết quả cho “${query}”. Thử từ khoá ngắn hơn, ví dụ “học bổng” hoặc “bản đồ”.`}
            action={{ label: "Xoá bộ lọc", onClick: () => { setQuery(""); setActiveGroup(ALL_GROUPS); } }}
          />
        </div>
      ) : (
        <div className="space-y-8">
          {visibleGroups.map((group) => {
            const GroupIcon = group.icon;
            return (
              <section key={group.id} aria-labelledby={`group-${group.id}`}>
                {/* Group header — identical structure for every group so the
                    left edge of each section title lines up. */}
                <div className="mb-3 flex items-start gap-3 border-b border-border pb-2.5">
                  <GroupIcon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <h2
                      id={`group-${group.id}`}
                      className="text-sm font-semibold tracking-tight text-foreground"
                    >
                      {group.label}
                      <span className="ml-2 text-xs font-normal text-foreground/40">
                        {group.items.length}
                      </span>
                    </h2>
                    <p className="mt-0.5 line-clamp-1 text-xs text-foreground/50">
                      {group.description}
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {group.items.map((feature) => {
                    const Icon = feature.icon;
                    return (
                      <Link
                        key={feature.id}
                        href={feature.href}
                        className="group flex h-full flex-col rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/50 focus-visible:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                      >
                        <div className="flex items-start gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-background/60 text-primary">
                            <Icon className="h-4 w-4" />
                          </span>
                          <h3 className="min-w-0 flex-1 pt-1.5 text-sm font-semibold leading-tight text-foreground transition-colors group-hover:text-primary">
                            <span className="line-clamp-1">{feature.label}</span>
                          </h3>
                        </div>
                        <p className="mt-2 line-clamp-2 flex-1 text-xs leading-relaxed text-foreground/55">
                          {feature.description}
                        </p>
                        <span className="mt-auto inline-flex items-center gap-1 pt-3 text-[11px] font-semibold text-foreground/45 transition-colors group-hover:text-primary">
                          Mở
                          <ArrowUpRight className="h-3 w-3" />
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <p className="border-t border-border pt-4 text-xs text-foreground/40">
        EduMap chạy trên Hugging Face Spaces (gói miễn phí): lần truy cập đầu tiên sau khi
        khởi động lại có thể chậm 30–60 giây. Tính năng AI tự chuyển sang phương án dự phòng
        khi nhà cung cấp tạm thời không phản hồi.
      </p>
    </main>
  );
}
