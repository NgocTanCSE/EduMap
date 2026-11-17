"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Layers, Search, X } from "lucide-react";
import SectionHeader from "@/components/ui/SectionHeader";
import EmptyState from "@/components/ui/EmptyState";
import { FEATURES, FEATURE_GROUPS, matchesFeature, type FeatureGroupId, } from "@/src/lib/feature-catalog";
const ALL_GROUPS = "all" as const;
type GroupFilter = typeof ALL_GROUPS | FeatureGroupId;
export function FeatureQuickNav() {
    const [query, setQuery] = useState("");
    const [activeGroup, setActiveGroup] = useState<GroupFilter>(ALL_GROUPS);
    const filtered = useMemo(() => FEATURES.filter((feature) => (activeGroup === ALL_GROUPS || feature.group === activeGroup) && matchesFeature(feature, query)), [query, activeGroup]);
    const visibleGroups = useMemo(() => FEATURE_GROUPS.map((group) => ({ ...group, items: filtered.filter((feature) => feature.group === group.id) })).filter((group) => group.items.length > 0), [filtered]);
    return (<section className="rounded-[22px] border border-border/80 bg-card p-6 shadow-orvel space-y-6">
      <SectionHeader icon={Layers} title="Tính năng EduMap" subtitle="Tìm nhanh bất kỳ tính năng nào — học bổng, wifi, việc làm, dịch thuật…" right={<span className="inline-flex items-center rounded-full border border-border bg-secondary/80 px-3 py-1 text-xs font-semibold text-foreground/80">{FEATURES.length} tính năng</span>}/>
      <div className="space-y-3">
        <div className="relative">
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40"/>
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm tính năng: học bổng, wifi, bản đồ, dịch thuật…" aria-label="Tìm tính năng" className="w-full rounded-2xl border border-border/80 bg-card py-3 pl-10 pr-10 text-sm text-foreground placeholder:text-foreground/40 shadow-sm focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"/>
          {query && (<button type="button" onClick={() => setQuery("")} aria-label="Xoá từ khoá tìm kiếm" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-foreground/50 transition-colors hover:bg-muted hover:text-foreground"><X className="h-4 w-4"/></button>)}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setActiveGroup(ALL_GROUPS)} aria-pressed={activeGroup === ALL_GROUPS} className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${activeGroup === ALL_GROUPS ? "border-primary/50 bg-primary/15 text-primary" : "border-border bg-card text-foreground/60 hover:border-border hover:text-foreground"}`}>
            Tất cả ({FEATURES.length})
          </button>
          {FEATURE_GROUPS.map((group) => {
            const Icon = group.icon;
            const count = FEATURES.filter((f) => f.group === group.id).length;
            return (<button key={group.id} type="button" onClick={() => setActiveGroup(group.id)} aria-pressed={activeGroup === group.id} className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${activeGroup === group.id ? "border-primary/50 bg-primary/15 text-primary" : "border-border bg-card text-foreground/60 hover:text-foreground"}`}><Icon className="h-3.5 w-3.5"/>{group.label}<span className="text-foreground/40">{count}</span></button>);
          })}
        </div>
      </div>
      {filtered.length === 0 ? (<div className="rounded-xl border border-dashed border-border bg-card/40"><EmptyState icon={<Search className="h-7 w-7 text-foreground/30"/>} title="Không tìm thấy tính năng phù hợp" description={`Không có kết quả cho “${query}”. Thử từ khoá ngắn hơn, ví dụ “học bổng” hoặc “bản đồ”.`} action={{ label: "Xoá bộ lọc", onClick: () => { setQuery(""); setActiveGroup(ALL_GROUPS); } }}/></div>) : (<div className="space-y-6">
        {visibleGroups.map((group) => {
          const GroupIcon = group.icon;
          return (<section key={group.id} aria-labelledby={`group-${group.id}`} className="space-y-3">
            <div className="flex items-start gap-3">
              <GroupIcon className="mt-0.5 h-4 w-4 shrink-0 text-primary"/>
              <div className="min-w-0">
                <h2 id={`group-${group.id}`} className="text-sm font-semibold tracking-tight text-foreground">{group.label}<span className="ml-2 text-xs font-normal text-foreground/40">{group.items.length}</span></h2>
                <p className="mt-0.5 line-clamp-1 text-xs text-foreground/50">{group.description}</p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {group.items.map((feature) => {
                const Icon = feature.icon;
                return (<Link key={feature.id} href={feature.href} className="group flex h-full flex-col rounded-xl border border-border/80 bg-card p-4 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-pop focus-visible:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30">
                  <div className="flex items-start gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-background/80 text-primary shadow-xs transition-colors group-hover:bg-primary/10"><Icon className="h-4 w-4"/></span>
                    <h3 className="min-w-0 flex-1 pt-1 text-sm font-semibold leading-tight text-foreground transition-colors group-hover:text-primary"><span className="line-clamp-1">{feature.label}</span></h3>
                  </div>
                  <p className="mt-2 line-clamp-2 flex-1 text-xs leading-relaxed text-foreground/55">{feature.description}</p>
                  <span className="mt-auto inline-flex items-center gap-1 pt-2 text-[11px] font-semibold text-foreground/45 transition-colors group-hover:text-primary">Mở<ArrowUpRight className="h-3 w-3"/></span>
                </Link>);
              })}
            </div>
          </section>);
        })}
      </div>)}
    </section>);
}