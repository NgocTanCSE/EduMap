import React from 'react';
import { cn } from '@/src/lib/utils';
interface SkeletonProps {
    className?: string;
    variant?: 'text' | 'circular' | 'rectangular';
    width?: string | number;
    height?: string | number;
    animation?: boolean;
}
function Skeleton({ className = '', variant = 'rectangular', width, height, animation = true }: SkeletonProps) {
    const baseClasses = 'bg-muted/20';
    const animationClasses = animation ? 'animate-pulse' : '';
    const variantClasses = {
        text: 'rounded',
        circular: 'rounded-full',
        rectangular: 'rounded-lg'
    };
    const style: React.CSSProperties = {};
    if (width)
        style.width = typeof width === 'number' ? `${width}px` : width;
    if (height)
        style.height = typeof height === 'number' ? `${height}px` : height;
    return (<div className={cn(baseClasses, variantClasses[variant], animationClasses, className)} style={style} aria-hidden="true"/>);
}
export default Skeleton;
export { Skeleton };
export function SkeletonText({ lines = 3, className = '' }: {
    lines?: number;
    className?: string;
}) {
    return (<div className={`space-y-2 ${className}`} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (<Skeleton key={i} variant="text" className={`h-4 ${i === lines - 1 ? 'w-3/4' : 'w-full'}`}/>))}
    </div>);
}
export function SkeletonCard({ className = '' }: {
    className?: string;
}) {
    return (<div className={`p-4 bg-muted/20 rounded-xl border border-border/10 ${className}`} aria-hidden="true">
      <div className="flex items-center gap-4 mb-4">
        <Skeleton variant="circular" width={48} height={48}/>
        <div className="flex-1">
          <Skeleton variant="text" className="h-4 w-1/3 mb-2"/>
          <Skeleton variant="text" className="h-3 w-1/2"/>
        </div>
      </div>
      <Skeleton variant="rectangular" className="h-32 mb-4"/>
      <SkeletonText lines={2}/>
    </div>);
}
export function SkeletonList({ count = 5, className = '' }: {
    count?: number;
    className?: string;
}) {
    return (<div className={`space-y-4 ${className}`} aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (<SkeletonCard key={i}/>))}
    </div>);
}
export function SkeletonTable({ rows = 5, cols = 4, className = '' }: {
    rows?: number;
    cols?: number;
    className?: string;
}) {
    return (<div className={`space-y-3 ${className}`} aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (<div key={i} className="flex gap-4">
          {Array.from({ length: cols }).map((_, j) => (<Skeleton key={j} variant="text" className={`h-4 ${j === 0 ? 'w-1/4' : 'flex-1'}`}/>))}
        </div>))}
    </div>);
}
export function CardSkeleton({ className = '' }: {
    className?: string;
}) {
    return (<div className={cn('h-full rounded-xl border border-border bg-card p-5 space-y-4', className)}>
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-20"/>
        <Skeleton className="h-6 w-1/2"/>
      </div>
      <div className="flex gap-4">
        <Skeleton className="h-4 w-24"/>
        <Skeleton className="h-4 w-24"/>
        <Skeleton className="h-4 w-24"/>
      </div>
      <div className="flex gap-2 pt-2">
        <Skeleton className="h-6 w-16"/>
        <Skeleton className="h-6 w-16"/>
        <Skeleton className="h-6 w-16"/>
      </div>
    </div>);
}
export function StatSkeleton({ className = '' }: {
    className?: string;
}) {
    return (<div className={cn('flex items-center justify-between rounded-xl border border-border bg-card p-5', className)}>
      <div className="space-y-2">
        <Skeleton className="h-3 w-24"/>
        <Skeleton className="h-10 w-16"/>
      </div>
      <Skeleton className="h-12 w-12 rounded-full"/>
    </div>);
}
