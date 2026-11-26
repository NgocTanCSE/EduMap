"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { featuresForGroup, type FeatureGroupId } from "@/src/lib/feature-catalog";

interface HubTabBarProps {
    hubId: FeatureGroupId;
}

export function HubTabBar({ hubId }: HubTabBarProps) {
    const pathname = usePathname() || "";
    const tabs = featuresForGroup(hubId);
    if (tabs.length < 2) {
        return null;
    }
    return (<div className="shrink-0 border-b border-border bg-card overflow-x-auto scrollbar-hide [mask-image:linear-gradient(to_right,transparent,black_12px,black_calc(100%_-_12px),transparent)]">
      <div className="flex flex-nowrap items-center gap-1.5 p-3" style={{ minWidth: "max-content" }}>
        {tabs.map((tab) => {
            const [path] = tab.href.split("?");
            const normalized = path.replace(/\/$/, "");
            const active = tab.href.includes("?") ? false : pathname === path || pathname === normalized;
            const Icon = tab.icon;
            return (<Link key={tab.id} href={tab.href} scroll={false} className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-colors ${active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground/60 hover:bg-muted/50"}`}>
              <Icon className="w-3.5 h-3.5"/> {tab.label}
            </Link>);
        })}
      </div>
    </div>);
}
