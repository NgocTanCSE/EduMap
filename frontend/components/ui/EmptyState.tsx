import React from 'react';
import { Inbox } from 'lucide-react';

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
    <div className={`flex flex-col items-center justify-center py-12 px-4 ${className}`}>
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl border border-border bg-card">
        {icon || <Inbox className="w-8 h-8 text-foreground/30" />}
      </div>
      <h3 className="text-lg font-medium text-foreground/80 mb-2">{title}</h3>
      {description && (
        <p className="text-sm text-foreground/50 text-center max-w-md mb-4">{description}</p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
