import { toast as sonnerToast } from 'sonner';
export const TOASTS_ENABLED = process.env.NEXT_PUBLIC_TOASTS_ENABLED === 'true';
type ToastFn = typeof sonnerToast;
const noop = (): string => '';
const silentToast = Object.assign(noop, {
    success: noop,
    error: noop,
    info: noop,
    warning: noop,
    message: noop,
    loading: noop,
    promise: noop,
    custom: noop,
    dismiss: noop,
    getHistory: () => [],
}) as unknown as ToastFn;
export const toast: ToastFn = TOASTS_ENABLED ? sonnerToast : silentToast;
