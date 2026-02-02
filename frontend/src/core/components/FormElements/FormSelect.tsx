/**
 * Form Select Component
 * 
 * Reusable dropdown select with label and error.
 */

import { type SelectHTMLAttributes } from 'react';

export interface SelectOption {
    value: string;
    label: string;
    disabled?: boolean;
}

export interface FormSelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'className'> {
    label: string;
    options: SelectOption[];
    error?: string;
    placeholder?: string;
}

export function FormSelect({
    label,
    options,
    error,
    placeholder,
    required,
    id,
    ...props
}: FormSelectProps) {
    const selectId = id || `select-${label.toLowerCase().replace(/\s+/g, '-')}`;

    return (
        <div className={`form-field ${error ? 'form-field--error' : ''}`}>
            <label htmlFor={selectId} className="form-label">
                {label}
                {required && <span className="form-required">*</span>}
            </label>
            <select
                id={selectId}
                className="form-select"
                aria-invalid={!!error}
                {...props}
            >
                {placeholder && (
                    <option value="" disabled>
                        {placeholder}
                    </option>
                )}
                {options.map(opt => (
                    <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                        {opt.label}
                    </option>
                ))}
            </select>
            {error && (
                <p className="form-error">{error}</p>
            )}
        </div>
    );
}
