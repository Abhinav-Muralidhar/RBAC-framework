/**
 * Form Modal Component
 * 
 * Reusable modal wrapper for create/edit forms.
 */

import { useEffect, useCallback, type ReactNode, type FormEvent } from 'react';
import { X } from 'lucide-react';
import './FormModal.css';

export interface FormModalProps {
    isOpen: boolean;
    title: string;
    children: ReactNode;
    isLoading?: boolean;
    submitLabel?: string;
    cancelLabel?: string;
    size?: 'sm' | 'md' | 'lg';
    onSubmit: () => void;
    onCancel: () => void;
}

export function FormModal({
    isOpen,
    title,
    children,
    isLoading = false,
    submitLabel = 'Save',
    cancelLabel = 'Cancel',
    size = 'md',
    onSubmit,
    onCancel,
}: FormModalProps) {
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

    const handleFormSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (!isLoading) {
            onSubmit();
        }
    };

    return (
        <div className="form-modal-overlay" onClick={isLoading ? undefined : onCancel}>
            <div
                className={`form-modal form-modal--${size}`}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <header className="form-modal__header">
                    <h2 className="form-modal__title">{title}</h2>
                    <button
                        type="button"
                        className="form-modal__close"
                        onClick={onCancel}
                        disabled={isLoading}
                        aria-label="Close"
                    >
                        <X size={20} />
                    </button>
                </header>

                {/* Form */}
                <form onSubmit={handleFormSubmit}>
                    <div className="form-modal__body">
                        {children}
                    </div>

                    {/* Footer */}
                    <footer className="form-modal__footer">
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={onCancel}
                            disabled={isLoading}
                        >
                            {cancelLabel}
                        </button>
                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={isLoading}
                        >
                            {isLoading ? 'Saving...' : submitLabel}
                        </button>
                    </footer>
                </form>
            </div>
        </div>
    );
}
