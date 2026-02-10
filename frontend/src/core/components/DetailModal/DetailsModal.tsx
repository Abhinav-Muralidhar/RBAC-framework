/**
 * Details Modal Component
 *
 * Generic, reusable modal for displaying entity details fetched by ID.
 * Each page configures it via a `fields` array and `fetchFn`.
 */

import { useEffect, useCallback, useState, type ReactNode } from 'react';
import { X, AlertCircle } from 'lucide-react';
import './DetailModal.css';

// ---------- Types ----------

export interface FieldConfig<T> {
    /** Display label */
    label: string;
    /** Key on the entity object (supports dot-path for simple access) */
    key: keyof T | string;
    /** Optional custom renderer */
    render?: (value: any, item: T) => ReactNode;
    /** Hide this field entirely */
    hidden?: boolean;
}

export interface DetailsModalProps<T> {
    isOpen: boolean;
    title: string;
    entityId: string | number | null;
    /** Fetches the full entity by ID */
    fetchFn: (id: string) => Promise<T>;
    /** Field configuration array */
    fields: FieldConfig<T>[];
    onClose: () => void;
    size?: 'sm' | 'md' | 'lg';
}

// ---------- Helpers ----------

function getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((acc, part) => acc?.[part], obj);
}

function formatValue(value: any): ReactNode {
    if (value === null || value === undefined || value === '') return <span className="details-modal__empty">—</span>;
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (value instanceof Date) return value.toLocaleString();
    if (typeof value === 'object') {
        try {
            return <pre className="details-modal__json">{JSON.stringify(value, null, 2)}</pre>;
        } catch {
            return String(value);
        }
    }
    return String(value);
}

// ---------- Component ----------

export function DetailsModal<T extends Record<string, any>>({
    isOpen,
    title,
    entityId,
    fetchFn,
    fields,
    onClose,
    size = 'md',
}: DetailsModalProps<T>) {
    const [data, setData] = useState<T | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Fetch data when modal opens with a valid ID
    useEffect(() => {
        if (!isOpen || entityId === null || entityId === undefined) {
            setData(null);
            setError(null);
            return;
        }

        let cancelled = false;
        setLoading(true);
        setError(null);

        fetchFn(String(entityId))
            .then((result) => {
                if (!cancelled) setData(result);
            })
            .catch((err) => {
                if (!cancelled) setError(err?.message || 'Failed to load details');
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => { cancelled = true; };
    }, [isOpen, entityId, fetchFn]);

    // ESC to close
    const handleKeyDown = useCallback(
        (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        },
        [onClose],
    );

    useEffect(() => {
        if (isOpen) {
            document.addEventListener('keydown', handleKeyDown);
            document.body.style.overflow = 'hidden';
        }
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = '';
        };
    }, [isOpen, handleKeyDown]);

    if (!isOpen) return null;

    const visibleFields = fields.filter((f) => !f.hidden);

    return (
        <div className="details-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
            <div
                className={`details-modal details-modal--${size}`}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <header className="details-modal__header">
                    <h2 className="details-modal__title">{title}</h2>
                    <button
                        type="button"
                        className="details-modal__close"
                        onClick={onClose}
                        aria-label="Close"
                    >
                        <X size={20} />
                    </button>
                </header>

                {/* Body */}
                <div className="details-modal__body">
                    {loading && (
                        <div className="details-modal__skeleton">
                            {Array.from({ length: 6 }).map((_, i) => (
                                <div key={i} className="skeleton-row">
                                    <div className="skeleton-label" />
                                    <div className="skeleton-value" />
                                </div>
                            ))}
                        </div>
                    )}

                    {error && (
                        <div className="details-modal__error">
                            <AlertCircle size={18} />
                            <span>{error}</span>
                        </div>
                    )}

                    {!loading && !error && data && (
                        <dl className="details-modal__fields">
                            {visibleFields.map((field) => {
                                const rawValue = getNestedValue(data, field.key as string);
                                const rendered = field.render
                                    ? field.render(rawValue, data)
                                    : formatValue(rawValue);

                                return (
                                    <div key={field.key as string} className="details-modal__field">
                                        <dt className="details-modal__field-label">{field.label}</dt>
                                        <dd className="details-modal__field-value">{rendered}</dd>
                                    </div>
                                );
                            })}
                        </dl>
                    )}
                </div>

                {/* Footer */}
                <footer className="details-modal__footer">
                    <button type="button" className="btn btn-secondary" onClick={onClose}>
                        Close
                    </button>
                </footer>
            </div>
        </div>
    );
}
