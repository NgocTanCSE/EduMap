"use client";

import React from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FeatureCardProps {
  title: string;
  description: string;
  icon?: React.ElementType;
  href?: string;
  badge?: string;
  actionText?: string;
  className?: string;
  iconBg?: string;
  iconColor?: string;
  children?: React.ReactNode;
  onClick?: () => void;
}

export function FeatureCard({
  title,
  description,
  icon: Icon,
  href,
  badge,
  actionText = "Khám phá",
  className,
  iconBg,
  iconColor,
  children,
  onClick,
}: FeatureCardProps) {
  const CardWrapper = ({ children: innerContent }: { children: React.ReactNode }) => {
    if (href) {
      return (
        <Link
          href={href}
          className={cn(
            "group relative flex h-full flex-col justify-between overflow-hidden rounded-[22px] border border-border/70 bg-card p-6 shadow-orvel transition-all duration-200 hover:-translate-y-0.5 hover:border-border hover:shadow-pop",
            className
          )}
        >
          {innerContent}
        </Link>
      );
    }

    return (
      <div
        onClick={onClick}
        className={cn(
          "group relative flex h-full flex-col justify-between overflow-hidden rounded-[22px] border border-border/70 bg-card p-6 shadow-orvel transition-all duration-200 hover:-translate-y-0.5 hover:border-border hover:shadow-pop",
          onClick && "cursor-pointer",
          className
        )}
      >
        {innerContent}
      </div>
    );
  };

  return (
    <CardWrapper>
      <div>
        <div className="flex items-start justify-between gap-3">
          {Icon && (
            <div
              className={cn(
                "flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] border border-border/60 bg-secondary/80 text-primary shadow-sm transition-transform duration-200 group-hover:scale-105",
                iconBg,
                iconColor
              )}
            >
              <Icon className="h-6 w-6" />
            </div>
          )}

          <div className="flex items-center gap-2">
            {badge && (
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                {badge}
              </span>
            )}
            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-border/60 bg-secondary/50 text-muted-foreground transition-all duration-200 group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary">
              <ArrowUpRight className="h-4 w-4" />
            </div>
          </div>
        </div>

        <div className="mt-5">
          <h3 className="text-lg font-bold tracking-tight text-foreground transition-colors group-hover:text-primary">
            {title}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground line-clamp-3">
            {description}
          </p>
        </div>

        {children && <div className="mt-4">{children}</div>}
      </div>

      <div className="mt-6 flex items-center justify-between border-t border-border/40 pt-4 text-xs font-semibold text-primary">
        <span>{actionText}</span>
        <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </div>
    </CardWrapper>
  );
}

export default FeatureCard;

