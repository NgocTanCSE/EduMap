"use client";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import ContentShell from "@/components/ui/ContentShell";
import SectionHeader from "@/components/ui/SectionHeader";
import { HubTabBar } from "./HubTabBar";
import { FEATURES, groupById, type FeatureGroupId } from "@/src/lib/feature-catalog";

interface HubLandingProps {
    hubId: FeatureGroupId;
}

export function HubLanding({ hubId }: HubLandingProps) {
    const group = groupById(hubId);
    const items = FEATURES.filter((feature) => feature.group === hubId && !feature.sidebar);
    if (!group) {
        return null;
    }
    const GroupIcon = group.icon;
    return (<ContentShell>
      <HubTabBar hubId={hubId}/>
      <SectionHeader icon={GroupIcon} title={group.label} subtitle={group.description} right={<span className="inline-flex items-center rounded-full border border-border bg-secondary/80 px-3 py-1 text-xs font-semibold text-foreground/80">
            {items.length} tính năng
          </span>}/>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((feature) => {
            const Icon = feature.icon;
            return (<Link key={feature.id} href={feature.href} className="group flex h-full flex-col rounded-[20px] border border-border/80 bg-card p-5 shadow-orvel transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-pop focus-visible:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] border border-border/70 bg-background/80 text-primary shadow-xs transition-colors group-hover:bg-primary/10">
                <Icon className="h-4 w-4"/>
              </span>
              <h2 className="min-w-0 flex-1 pt-1.5 text-sm font-semibold leading-tight text-foreground transition-colors group-hover:text-primary">
                <span className="line-clamp-1">{feature.label}</span>
              </h2>
            </div>
            <p className="mt-2 line-clamp-2 flex-1 text-xs leading-relaxed text-foreground/55">
              {feature.description}
            </p>
            <span className="mt-auto inline-flex items-center gap-1 pt-3 text-[11px] font-semibold text-foreground/45 transition-colors group-hover:text-primary">
              Mở
              <ArrowUpRight className="h-3 w-3"/>
            </span>
          </Link>);
        })}
      </div>
    </ContentShell>);
}
