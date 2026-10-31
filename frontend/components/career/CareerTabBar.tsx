"use client";
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  TrendingUp, Briefcase, Compass, BrainCircuit, Rocket, Target, BarChart3,
} from "lucide-react";

interface TabDef {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  matchPattern?: RegExp;
}

export const CAREER_TABS: TabDef[] = [
  { id: "dashboard", label: "Tổng quan", icon: TrendingUp, href: "/career" },
  { id: "jobs", label: "Việc làm", icon: Briefcase, href: "/career/jobs" },
  { id: "roadmap", label: "Lộ trình", icon: Compass, href: "/career/roadmap" },
  { id: "predictive", label: "Dự báo AI", icon: BrainCircuit, href: "/career/predictive" },
  { id: "opportunities", label: "Cơ hội", icon: Rocket, href: "/opportunities" },
  { id: "radar", label: "Opportunity Radar", icon: Target, href: "/opportunities/radar" },
  { id: "analytics", label: "Thống kê", icon: BarChart3, href: "/analytics/trends" },
];

/**
 * Shared Career Hub tab bar.
 *
 * Rendered on /career (dashboard) and all 6 sub-pages so the user always
 * sees the same 7-tab navigation row — preserving the Career Hub user flow
 * regardless of which tab they land on.
 *
 * Active tab is resolved from the current pathname (works on SSR + client).
 */
export function CareerTabBar() {
  const pathname = usePathname();

  const isActiveTab = (tab: TabDef): boolean => {
    if (tab.id === "dashboard") return pathname === "/career" || pathname === "/career/";
    return pathname === tab.href || pathname === tab.href.replace(/\/$/, "");
  };

  return (
    <div className="border-b border-border bg-card overflow-x-auto scrollbar-hide">
      <div className="flex flex-nowrap items-center gap-1.5 p-3" style={{ minWidth: 'max-content' }}>
        {CAREER_TABS.map((tab) => {
          const active = isActiveTab(tab);
          return (
            <Link
              key={tab.id}
              href={tab.href}
              scroll={false}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-colors ${
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground/60 hover:bg-muted/50"
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" /> {tab.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
