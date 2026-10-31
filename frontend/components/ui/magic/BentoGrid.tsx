"use client";

import React, { ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BentoGridProps {
  children: ReactNode;
  className?: string;
}

export function BentoGrid({ children, className }: BentoGridProps) {
  return (
    <div
      className={cn(
        "grid w-full auto-rows-[22rem] grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5",
        className
      )}
    >
      {children}
    </div>
  );
}

export interface BentoCardProps {
  name: string;
  className?: string;
  background?: ReactNode;
  icon?: React.ElementType;
  description: string;
  href?: string;
  cta?: string;
  badge?: string;
}

export function BentoCard({
  name,
  className,
  background,
  icon: Icon,
  description,
  href,
  cta = "Chi tiết",
  badge,
}: BentoCardProps) {
  const CardContent = (
    <>
      {/* Background Graphic Slot */}
      {background && (
        <div className="absolute inset-0 z-0 overflow-hidden opacity-80 transition-opacity duration-300 group-hover:opacity-100">
          {background}
        </div>
      )}

      {/* Decorative gradient overlay */}
      <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-t from-card via-card/60 to-transparent" />

      {/* Top Header / Badge */}
      <div className="relative z-20 flex items-start justify-between">
        {Icon && (
          <div className="flex h-11 w-11 items-center justify-center rounded-[14px] border border-border/70 bg-card/90 text-primary shadow-sm backdrop-blur-sm transition-transform duration-200 group-hover:scale-105">
            <Icon className="h-5 w-5" />
          </div>
        )}

        <div className="flex items-center gap-2">
          {badge && (
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary backdrop-blur-sm">
              {badge}
            </span>
          )}
          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-border/60 bg-card/80 text-muted-foreground backdrop-blur-sm transition-all duration-200 group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary">
            <ArrowUpRight className="h-4 w-4" />
          </div>
        </div>
      </div>

      {/* Bottom text & CTA */}
      <div className="relative z-20 mt-auto pt-4">
        <h3 className="text-lg font-bold tracking-tight text-foreground transition-colors group-hover:text-primary">
          {name}
        </h3>
        <p className="mt-1.5 text-xs sm:text-sm text-muted-foreground line-clamp-2">
          {description}
        </p>

        {href && (
          <div className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-primary">
            <span>{cta}</span>
            <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </div>
        )}
      </div>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className={cn(
          "group relative flex flex-col justify-between overflow-hidden rounded-[22px] border border-border/70 bg-card p-6 shadow-orvel transition-all duration-300 hover:-translate-y-1 hover:border-border hover:shadow-pop",
          className
        )}
      >
        {CardContent}
      </Link>
    );
  }

  return (
    <div
      className={cn(
        "group relative flex flex-col justify-between overflow-hidden rounded-[22px] border border-border/70 bg-card p-6 shadow-orvel transition-all duration-300 hover:-translate-y-1 hover:border-border hover:shadow-pop",
        className
      )}
    >
      {CardContent}
    </div>
  );
}

