/**
 * Form Input Component
 * 
 * Reusable text/email/password input with label, error, and validation.
 */

import { type InputHTMLAttributes } from 'react';

export interface FormInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> {
    label: string;
    error?: string;
    hint?: string;
}

export function FormInput({
    label,
    error,
    hint,
    required,
    id,
    ...props
}: FormInputProps) {
    const inputId = id || `input-${label.toLowerCase().replace(/\s+/g, '-')}`;

    return (
        <div className={`form-field ${error ? 'form-field--error' : ''}`}>
            <label htmlFor={inputId} className="form-label">
                {label}
                {required && <span className="form-required">*</span>}
            </label>
            <input
                id={inputId}
                className="form-input"
                aria-invalid={!!error}
                aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
                {...props}
            />
            {hint && !error && (
                <p id={`${inputId}-hint`} className="form-hint">{hint}</p>
            )}
            {error && (
                <p id={`${inputId}-error`} className="form-error">{error}</p>
            )}
        </div>
    );
}
