"use client";

import React from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StatisticCardProps {
  title: string;
  value: string | number;
  icon?: React.ElementType;
  trend?: {
    value: number;
    label?: string;
    isPositiveGood?: boolean;
  };
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
  badge?: string;
  iconColor?: string;
  iconBg?: string;
}

export function StatisticCard({
  title,
  value,
  icon: Icon,
  trend,
  subtitle,
  action,
  className,
  badge,
  iconColor,
  iconBg,
}: StatisticCardProps) {
  const isNeutral = !trend || Math.abs(trend.value) < 0.005;
  const isUp = trend && trend.value > 0;
  const isGood =
    trend &&
    (trend.isPositiveGood !== false ? isUp : !isUp);

  return (
    <div
      className={cn(
        "group relative flex flex-col justify-between overflow-hidden rounded-[22px] border border-border/70 bg-card p-6 shadow-orvel transition-all duration-200 hover:-translate-y-0.5 hover:border-border hover:shadow-pop",
        className
      )}
    >
      {/* Top Header Row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          {Icon && (
            <div
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] border border-border/60 bg-secondary/80 text-primary shadow-sm transition-transform duration-200 group-hover:scale-105",
                iconBg,
                iconColor
              )}
            >
              <Icon className="h-5 w-5" />
            </div>
          )}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {title}
            </p>
            {badge && (
              <span className="mt-0.5 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                {badge}
              </span>
            )}
          </div>
        </div>

        {action && <div className="shrink-0">{action}</div>}
      </div>

      {/* Main Metric Value */}
      <div className="mt-5">
        <div className="text-3xl font-extrabold tracking-tight text-foreground tabular-nums sm:text-4xl">
          {value}
        </div>

        {/* Footer / Trend Info */}
        {(trend || subtitle) && (
          <div className="mt-3 flex flex-wrap items-center gap-2 pt-1 text-xs">
            {trend && (
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-semibold tabular-nums",
                  isNeutral
                    ? "bg-secondary text-muted-foreground"
                    : isGood
                      ? "bg-accent/15 text-accent"
                      : "bg-destructive/10 text-destructive"
                )}
              >
                {isNeutral ? (
                  <Minus className="h-3 w-3" />
                ) : isUp ? (
                  <ArrowUpRight className="h-3.5 w-3.5" />
                ) : (
                  <ArrowDownRight className="h-3.5 w-3.5" />
                )}
                {trend.value > 0 ? `+${trend.value}%` : `${trend.value}%`}
              </span>
            )}

            {subtitle && (
              <span className="text-muted-foreground">{subtitle}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default StatisticCard;

