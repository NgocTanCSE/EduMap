import React from 'react';
import { Inbox } from 'lucide-react';
import { cn } from "@/lib/utils";
import { Button } from './button';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export default function EmptyState({
  icon,
  title,
  description,
  action,
  className = ''
}: EmptyStateProps) {
  return (
    <div className={cn(`flex flex-col items-center justify-center py-12 px-4`, className)}>
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl border border-border bg-card">
        {icon || <Inbox className="w-8 h-8 text-foreground/30" />}
      </div>
      <h3 className="h3-card text-foreground/80 mb-2">{title}</h3>
      {description && (
        <p className="text-sm text-foreground/50 text-center max-w-md mb-4">{description}</p>
      )}
      {action && (
        <Button variant="default" size="sm" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
