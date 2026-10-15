import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
}

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Xác nhận',
  cancelLabel = 'Hủy',
  variant = 'danger'
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  const variantStyles = {
    danger: {
      icon: 'bg-destructive/10 border-destructive/20',
      iconColor: 'text-destructive',
      button: 'bg-destructive hover:bg-destructive'
    },
    warning: {
      icon: 'bg-primary/10 border-primary/20',
      iconColor: 'text-primary',
      button: 'bg-primary hover:bg-primary'
    },
    info: {
      icon: 'bg-accent/10 border-accent/20',
      iconColor: 'text-accent',
      button: 'bg-accent hover:bg-accent'
    }
  };

  const styles = variantStyles[variant];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Dialog */}
      <div className="relative bg-popover border border-border/10 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-lg text-foreground/40 hover:text-foreground hover:bg-muted/30 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Icon */}
        <div className={`w-12 h-12 rounded-full ${styles.icon} border flex items-center justify-center mb-4`}>
          <AlertTriangle className={`w-6 h-6 ${styles.iconColor}`} />
        </div>

        {/* Content */}
        <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
        <p className="text-sm text-foreground/60 mb-6">{message}</p>

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-muted/20 border border-border/10 text-foreground rounded-lg text-sm font-medium hover:bg-muted/30 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`px-4 py-2 ${styles.button} text-foreground rounded-lg text-sm font-medium transition-colors`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
