import { useEffect, useCallback } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { lockBodyScroll } from '../../../shared/lib/bodyScrollLock';
import './ConfirmModal.css';

export interface ConfirmModalProps {
    isOpen: boolean;
    title?: string;
    message: string;
    itemName?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'default' | 'danger';
    isLoading?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}

export function ConfirmModal({
    isOpen,
    title = 'Confirm Action',
    message,
    itemName,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    variant = 'default',
    isLoading = false,
    onConfirm,
    onCancel,
}: ConfirmModalProps) {
    const isDanger = variant === 'danger';

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (e.key === 'Escape' && !isLoading) {
            onCancel();
        }
    }, [onCancel, isLoading]);

    useEffect(() => {
        if (!isOpen) return;

        document.addEventListener('keydown', handleKeyDown);
        const unlockBodyScroll = lockBodyScroll();

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            unlockBodyScroll();
        };
    }, [isOpen, handleKeyDown]);

    if (!isOpen) return null;

    return (
        <div className="confirm-modal-overlay" onClick={isLoading ? undefined : onCancel}>
            <div
                className={`confirm-modal ${isDanger ? 'confirm-modal--danger' : ''}`}
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
            >
                <div className="confirm-modal__header">
                    <div className="confirm-modal__icon">
                        <AlertTriangle size={24} />
                    </div>
                    <h2 className="confirm-modal__title">{title}</h2>
                    <button
                        type="button"
                        className="confirm-modal__close"
                        onClick={onCancel}
                        disabled={isLoading}
                        aria-label="Close"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="confirm-modal__body">
                    <p>{message}</p>
                    {itemName && (
                        <div className="confirm-modal__item-name">
                            {itemName}
                        </div>
                    )}
                </div>

                <div className="confirm-modal__footer">
                    <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={onCancel}
                        disabled={isLoading}
                    >
                        {cancelLabel}
                    </button>
                    <button
                        type="button"
                        className={`btn ${isDanger ? 'btn-danger' : 'btn-primary'}`}
                        onClick={onConfirm}
                        disabled={isLoading}
                    >
                        {isLoading ? 'Processing...' : confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}

