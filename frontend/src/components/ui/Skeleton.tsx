import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
    />
  );
}

export function CardSkeleton() {
    return (
        <div className="h-full rounded-xl border border-border bg-card p-5 space-y-4">
            <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-6 w-1/2" />
            </div>
            <div className="flex gap-4">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-24" />
            </div>
            <div className="flex gap-2 pt-2">
                <Skeleton className="h-6 w-16" />
                <Skeleton className="h-6 w-16" />
                <Skeleton className="h-6 w-16" />
            </div>
        </div>
    );
}

export function StatSkeleton() {
    return (
        <div className="flex items-center justify-between rounded-xl border border-border bg-card p-5">
            <div className="space-y-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-10 w-16" />
            </div>
            <Skeleton className="h-12 w-12 rounded-full" />
        </div>
    );
}
