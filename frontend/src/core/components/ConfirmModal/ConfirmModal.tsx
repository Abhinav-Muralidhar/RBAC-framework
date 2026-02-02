/**
 * Confirm Modal Component
 * 
 * Custom confirmation dialog replacing browser confirm().
 * Supports danger mode for delete actions.
 */

import { useEffect, useCallback } from 'react';
import { AlertTriangle, X } from 'lucide-react';
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
    // Close on ESC key
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (e.key === 'Escape' && !isLoading) {
            onCancel();
        }
    }, [onCancel, isLoading]);

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

    return (
        <div className="confirm-modal-overlay" onClick={isLoading ? undefined : onCancel}>
            <div
                className={`confirm-modal ${variant === 'danger' ? 'confirm-modal--danger' : ''}`}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <header className="confirm-modal__header">
                    {variant === 'danger' && (
                        <div className="confirm-modal__icon">
                            <AlertTriangle size={24} />
                        </div>
                    )}
                    <h3 className="confirm-modal__title">{title}</h3>
                    <button
                        className="confirm-modal__close"
                        onClick={onCancel}
                        disabled={isLoading}
                        aria-label="Close"
                    >
                        <X size={18} />
                    </button>
                </header>

                {/* Body */}
                <div className="confirm-modal__body">
                    <p>{message}</p>
                    {itemName && (
                        <p className="confirm-modal__item-name">
                            <strong>{itemName}</strong>
                        </p>
                    )}
                </div>

                {/* Footer */}
                <footer className="confirm-modal__footer">
                    <button
                        className="btn btn-secondary"
                        onClick={onCancel}
                        disabled={isLoading}
                    >
                        {cancelLabel}
                    </button>
                    <button
                        className={`btn ${variant === 'danger' ? 'btn-danger' : 'btn-primary'}`}
                        onClick={onConfirm}
                        disabled={isLoading}
                    >
                        {isLoading ? 'Processing...' : confirmLabel}
                    </button>
                </footer>
            </div>
        </div>
    );
}
