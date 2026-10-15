/**
 * Toast Notification Context
 *
 * Provides a global toast notification system.
 * Usage:
 *   const toast = useToast();
 *   toast.success('Item saved');
 *   toast.error('Failed to save');
 *   toast.info('Processing…');
 */

import {
    createContext,
    useContext,
    useState,
    useCallback,
    useRef,
    type ReactNode,
} from 'react';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';
import './Toast.css';

// ─── Types ───────────────────────────────────────────

type ToastVariant = 'success' | 'error' | 'info';

interface Toast {
    id: string;
    variant: ToastVariant;
    message: string;
    duration: number;
    exiting?: boolean;
}

interface ToastContextValue {
    success: (message: string) => void;
    error: (message: string) => void;
    info: (message: string) => void;
}

// ─── Context ─────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null);

// eslint-disable-next-line react-refresh/only-export-components
export function useToast(): ToastContextValue {
    const ctx = useContext(ToastContext);
    if (!ctx) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return ctx;
}

// ─── Provider ────────────────────────────────────────

const DURATIONS: Record<ToastVariant, number> = {
    success: 4000,
    error: 6000,
    info: 4000,
};

let toastCounter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);
    const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

    const removeToast = useCallback((id: string) => {
        // Start exit animation
        setToasts(prev => prev.map(t => (t.id === id ? { ...t, exiting: true } : t)));

        // Remove after animation completes
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 300);

        // Clean up timer
        const timer = timersRef.current.get(id);
        if (timer) {
            clearTimeout(timer);
            timersRef.current.delete(id);
        }
    }, []);

    const addToast = useCallback((variant: ToastVariant, message: string) => {
        const id = `toast-${++toastCounter}`;
        const duration = DURATIONS[variant];

        setToasts(prev => [...prev, { id, variant, message, duration }]);

        // Auto-dismiss
        const timer = setTimeout(() => {
            removeToast(id);
        }, duration);
        timersRef.current.set(id, timer);
    }, [removeToast]);

    const success = useCallback((msg: string) => addToast('success', msg), [addToast]);
    const error = useCallback((msg: string) => addToast('error', msg), [addToast]);
    const info = useCallback((msg: string) => addToast('info', msg), [addToast]);

    const icons: Record<ToastVariant, ReactNode> = {
        success: <CheckCircle size={16} />,
        error: <XCircle size={16} />,
        info: <Info size={16} />,
    };

    const titles: Record<ToastVariant, string> = {
        success: 'Success',
        error: 'Error',
        info: 'Info',
    };

    return (
        <ToastContext.Provider value={{ success, error, info }}>
            {children}

            {/* Toast Render */}
            <div className="toast-container" role="status" aria-live="polite">
                {toasts.map(toast => (
                    <div
                        key={toast.id}
                        className={`toast toast--${toast.variant}${toast.exiting ? ' toast-exiting' : ''}`}
                    >
                        <div className="toast-icon">{icons[toast.variant]}</div>
                        <div className="toast-content">
                            <div className="toast-title">{titles[toast.variant]}</div>
                            <div className="toast-message">{toast.message}</div>
                        </div>
                        <button
                            className="toast-close"
                            onClick={() => removeToast(toast.id)}
                            aria-label="Dismiss"
                        >
                            <X size={14} />
                        </button>

                        {/* Auto-dismiss progress bar */}
                        <div
                            className="toast-progress"
                            style={{ animationDuration: `${toast.duration}ms` }}
                        />
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
}
