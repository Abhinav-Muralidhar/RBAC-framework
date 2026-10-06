import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle, Info, Loader2, X, XCircle } from 'lucide-react';
import { ToastContext } from './toast-context';
import { dismissToast, listeners, toast, toastState, type ToastItem, type ToastOptions, type ToastVariant } from './toast-store';
import './toast.css';

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>(toastState);
  const timersRef = useRef<Map<string, ReturnType<typeof window.setTimeout>>>(new Map());
  const canPortal = typeof document !== 'undefined';

  useEffect(() => {
    const listener = (nextToasts: ToastItem[]) => setToasts(nextToasts);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  useEffect(() => {
    const activeIds = new Set(toasts.map((toastItem) => toastItem.id));

    timersRef.current.forEach((timer, id) => {
      if (!activeIds.has(id)) {
        window.clearTimeout(timer);
        timersRef.current.delete(id);
      }
    });

    toasts.forEach((toastItem) => {
      if (toastItem.duration <= 0 || toastItem.exiting || timersRef.current.has(toastItem.id)) {
        return;
      }

      const timer = window.setTimeout(() => {
        dismissToast(toastItem.id);
      }, toastItem.duration);
      timersRef.current.set(toastItem.id, timer);
    });
  }, [toasts]);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      timers.clear();
    };
  }, []);

  const success = useCallback((message: string, options?: ToastOptions) => toast.success(message, options), []);
  const error = useCallback((message: string, options?: ToastOptions) => toast.error(message, options), []);
  const info = useCallback((message: string, options?: ToastOptions) => toast.info(message, options), []);
  const loading = useCallback((message: string, options?: ToastOptions) => toast.loading(message, options), []);
  const dismiss = useCallback((id?: string) => toast.dismiss(id), []);

  const icons: Record<ToastVariant, ReactNode> = {
    success: <CheckCircle size={16} />,
    error: <XCircle size={16} />,
    info: <Info size={16} />,
    loading: <Loader2 size={16} className="toast-spinner" />,
  };

  const titles: Record<ToastVariant, string> = {
    success: 'Success',
    error: 'Error',
    info: 'Info',
    loading: 'Working',
  };

  return (
    <ToastContext.Provider value={{ success, error, info, loading, dismiss }}>
      {children}
      {canPortal
        ? createPortal(
            <div className="toast-container" role="status" aria-live="polite">
              {toasts.map((toastItem) => (
                <div
                  key={toastItem.id}
                  className={`toast toast--${toastItem.variant}${toastItem.exiting ? ' toast-exiting' : ''}`}
                >
                  <div className="toast-icon">{icons[toastItem.variant]}</div>
                  <div className="toast-content">
                    <div className="toast-title">{titles[toastItem.variant]}</div>
                    <div className="toast-message">{toastItem.message}</div>
                  </div>
                  <button
                    className="toast-close"
                    onClick={() => dismissToast(toastItem.id)}
                    aria-label="Dismiss"
                  >
                    <X size={14} />
                  </button>
                  {toastItem.duration > 0 && (
                    <div
                      className="toast-progress"
                      style={{ animationDuration: `${toastItem.duration}ms` }}
                    />
                  )}
                </div>
              ))}
            </div>
            ,
            document.body
          )
        : null}
    </ToastContext.Provider>
  );
}
