/**
 * Form Multi-Select Component
 *
 * Reusable searchable multi-select with tag pills, dropdown options,
 * and built-in debounced search. Use for any multi-select scenario
 * (roles, users, profiles, etc.)
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Search } from 'lucide-react';

export interface MultiSelectOption {
    value: string;
    label: string;
    disabled?: boolean;
}

export interface FormMultiSelectProps {
    label: string;
    placeholder?: string;
    options: MultiSelectOption[];
    value: string[];
    onChange: (values: string[]) => void;
    onSearch?: (query: string) => void;
    loading?: boolean;
    error?: string;
    required?: boolean;
    id?: string;
    /** Debounce delay in ms for onSearch. Default 300. Set 0 to disable debounce. */
    debounceMs?: number;
    /** Message shown when there are no results */
    emptyMessage?: string;
}

export function FormMultiSelect({
    label,
    placeholder = 'Search…',
    options,
    value = [],
    onChange,
    onSearch,
    loading,
    error,
    required,
    id,
    debounceMs = 300,
    emptyMessage = 'No results found',
}: FormMultiSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const wrapperRef = useRef<HTMLDivElement>(null);
    const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const selectId = id || `multi-select-${label.toLowerCase().replace(/\s+/g, '-')}`;

    // Filter out already-selected items from the dropdown
    const availableOptions = options.filter(opt => !value.includes(opt.value));

    const handleSelect = (optionValue: string) => {
        if (value.includes(optionValue)) {
            onChange(value.filter(v => v !== optionValue));
        } else {
            onChange([...value, optionValue]);
            setSearchTerm('');
        }
    };

    // Debounced search handler
    const triggerSearch = useCallback(
        (query: string) => {
            if (!onSearch) return;

            if (debounceTimer.current) clearTimeout(debounceTimer.current);

            if (debounceMs <= 0) {
                onSearch(query);
                return;
            }

            debounceTimer.current = setTimeout(() => {
                onSearch(query);
            }, debounceMs);
        },
        [onSearch, debounceMs]
    );

    // Cleanup debounce timer on unmount
    useEffect(() => {
        return () => {
            if (debounceTimer.current) clearTimeout(debounceTimer.current);
        };
    }, []);

    // Close dropdown on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const getSelectedLabel = (val: string) => {
        const found = options.find(o => o.value === val);
        return found ? found.label : val;
    };

    return (
        <div className={`form-field ${error ? 'form-field--error' : ''}`} ref={wrapperRef}>
            <label htmlFor={selectId} className="form-label">
                {label}
                {required && <span className="form-required">*</span>}
            </label>

            {/* Selected Tags */}
            {value.length > 0 && (
                <div className="form-multi-select__tags">
                    {value.map(val => (
                        <span key={val} className="form-multi-select__tag">
                            {getSelectedLabel(val)}
                            <button
                                type="button"
                                onClick={() => handleSelect(val)}
                                className="form-multi-select__remove"
                            >
                                <X size={14} />
                            </button>
                        </span>
                    ))}
                </div>
            )}

            {/* Input Wrapper */}
            <div className="form-multi-select__input-wrapper">
                <Search size={16} className="form-multi-select__icon" />
                <input
                    id={selectId}
                    type="text"
                    className="form-multi-select__input"
                    placeholder={placeholder}
                    value={searchTerm}
                    autoComplete="off"
                    onFocus={() => setIsOpen(true)}
                    onChange={e => {
                        setSearchTerm(e.target.value);
                        triggerSearch(e.target.value);
                        setIsOpen(true);
                    }}
                    aria-invalid={!!error}
                />

                {/* Dropdown */}
                {isOpen && (
                    <div className="form-multi-select__dropdown">
                        {loading ? (
                            <div className="form-multi-select__empty">Loading…</div>
                        ) : availableOptions.length === 0 ? (
                            <div className="form-multi-select__empty">
                                {options.length === 0 ? emptyMessage : 'All items selected'}
                            </div>
                        ) : (
                            availableOptions.map(opt => (
                                <div
                                    key={opt.value}
                                    onClick={() => !opt.disabled && handleSelect(opt.value)}
                                    className={`form-multi-select__option ${opt.disabled ? 'form-multi-select__option--disabled' : ''
                                        }`}
                                >
                                    <span>{opt.label}</span>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>

            {error && <p className="form-error">{error}</p>}
        </div>
    );
}
