/**
 * Central toast switch.
 *
 * Every screen used to import `toast` straight from `sonner`, so there was no
 * single place to turn the popups off. All call sites now import from this
 * module instead, which makes the whole app's notifications controllable with
 * ONE flag:
 *
 *   NEXT_PUBLIC_TOASTS_ENABLED=true   → real sonner toasts (old behaviour)
 *   (unset / anything else)           → no-op, nothing is ever rendered
 *
 * Default is OFF (owner decision, 2026-11-01). `<Toaster />` in
 * `app/layout.tsx` reads the same flag, so re-enabling is a single env change
 * on HF Spaces → Settings → Variables, with no code edit.
 *
 * Keep the import surface identical to sonner's (`toast.success(...)`,
 * `toast.error(...)`, `toast.loading(...)`, …) so call sites do not need any
 * other change. Calls are intentionally silent rather than removed: the
 * surrounding logic (validation guards, "analysing…" placeholders) still runs,
 * only the visible popup is dropped.
 */
import { toast as sonnerToast } from 'sonner';

/** Single source of truth for "are toast popups visible at all?". */
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
