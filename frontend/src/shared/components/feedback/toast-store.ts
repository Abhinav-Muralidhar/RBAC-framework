type ToastVariant = 'success' | 'error' | 'info' | 'loading';

type ToastOptions = {
  id?: string;
  duration?: number;
};

type ToastItem = {
  id: string;
  variant: ToastVariant;
  message: string;
  duration: number;
  exiting?: boolean;
};

const DURATIONS: Record<Exclude<ToastVariant, 'loading'>, number> = {
  success: 4000,
  error: 6000,
  info: 4000,
};

const EXIT_ANIMATION_MS = 300;
const listeners = new Set<(toasts: ToastItem[]) => void>();

let toastCounter = 0;
let toastState: ToastItem[] = [];

const emit = () => {
  listeners.forEach((listener) => listener(toastState));
};

const upsertToast = (variant: ToastVariant, message: string, options?: ToastOptions) => {
  const id = options?.id ?? `toast-${++toastCounter}`;
  const duration =
    options?.duration ?? (variant === 'loading' ? 0 : DURATIONS[variant]);

  const existingIndex = toastState.findIndex((toast) => toast.id === id);
  const nextToast: ToastItem = {
    id,
    variant,
    message,
    duration,
    exiting: false,
  };

  if (existingIndex >= 0) {
    toastState = toastState.map((toast) => (toast.id === id ? nextToast : toast));
  } else {
    toastState = [...toastState, nextToast];
  }

  emit();
  return id;
};

const dismissToast = (id?: string) => {
  if (!id) {
    toastState = toastState.map((toast) => ({ ...toast, exiting: true }));
    emit();

    window.setTimeout(() => {
      toastState = [];
      emit();
    }, EXIT_ANIMATION_MS);
    return;
  }

  const target = toastState.find((toast) => toast.id === id);
  if (!target || target.exiting) return;

  toastState = toastState.map((toast) =>
    toast.id === id ? { ...toast, exiting: true } : toast
  );
  emit();

  window.setTimeout(() => {
    toastState = toastState.filter((toast) => toast.id !== id);
    emit();
  }, EXIT_ANIMATION_MS);
};

export const toast = {
  success: (message: string, options?: ToastOptions) => upsertToast('success', message, options),
  error: (message: string, options?: ToastOptions) => upsertToast('error', message, options),
  info: (message: string, options?: ToastOptions) => upsertToast('info', message, options),
  loading: (message: string, options?: ToastOptions) => upsertToast('loading', message, options),
  dismiss: (id?: string) => dismissToast(id),
};

export { dismissToast, listeners, toastState };
export type { ToastContextValue, ToastItem, ToastOptions, ToastVariant };

type ToastContextValue = {
  success: (message: string, options?: ToastOptions) => string;
  error: (message: string, options?: ToastOptions) => string;
  info: (message: string, options?: ToastOptions) => string;
  loading: (message: string, options?: ToastOptions) => string;
  dismiss: (id?: string) => void;
};
