/**
 * Form Search Select Component
 *
 * Reusable searchable single-select with built-in debounced search.
 * Use for any async or large-option single-select field.
 */

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Search, X } from 'lucide-react';

export interface SearchSelectOption {
    value: string;
    label: string;
    disabled?: boolean;
}

export interface FormSearchSelectProps {
  label: string;
  hideLabel?: boolean;
  value: string;
  options: SearchSelectOption[];
  onChange: (value: string) => void;
    onSearch?: (query: string) => void;
    placeholder?: string;
    loading?: boolean;
    error?: string;
    required?: boolean;
    id?: string;
    debounceMs?: number;
    emptyMessage?: string;
  allowClear?: boolean;
  disabled?: boolean;
  className?: string;
  disableAutoOpen?: boolean;
}

export function FormSearchSelect({
    label,
    hideLabel = false,
    value,
    options,
    onChange,
    onSearch,
    placeholder = 'Search...',
    loading,
    error,
    required,
    id,
    debounceMs = 300,
    emptyMessage = 'No results found',
    allowClear = false,
    disabled = false,
    className,
    disableAutoOpen = false,
}: FormSearchSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedLabel, setSelectedLabel] = useState('');
    const wrapperRef = useRef<HTMLDivElement>(null);
    const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const onSearchRef = useRef(onSearch);
    const selectId = id || `search-select-${label.toLowerCase().replace(/\s+/g, '-')}`;
    const selectedOption = useMemo(() => options.find(option => option.value === value), [options, value]);

    useEffect(() => {
        onSearchRef.current = onSearch;
    }, [onSearch]);

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

    useEffect(() => {
        return () => {
            if (debounceTimer.current) clearTimeout(debounceTimer.current);
        };
    }, []);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                if (isOpen) {
                    setIsOpen(false);
                    setSearchTerm('');
                    if (onSearchRef.current) {
                        onSearchRef.current('');
                    }
                }
            }
        }

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const handleSelect = (optionValue: string) => {
        const option = options.find((item) => item.value === optionValue);
        if (option) {
            setSelectedLabel(option.label);
        }
        onChange(optionValue);
        setSearchTerm('');
        setIsOpen(false);
        if (onSearch) {
            onSearch('');
        }
    };

    const handleClear = () => {
        onChange('');
        setSelectedLabel('');
        setSearchTerm('');
        setIsOpen(false);
        triggerSearch('');
    };

    const inputValue = isOpen ? searchTerm : value ? (selectedOption?.label || selectedLabel) : '';

    const visibleOptions = useMemo(() => {
        if (!isOpen) return options;

        if (onSearch) return options;

        const query = searchTerm.trim().toLowerCase();
        if (!query) return options;

        return options.filter((option) => option.label.toLowerCase().includes(query));
    }, [isOpen, onSearch, options, searchTerm]);

    const openDropdown = () => {
        if (disabled || isOpen) return;
        setIsOpen(true);
        setSearchTerm('');
        if (onSearch) {
            triggerSearch('');
        }
    };

    return (
        <div
            className={`form-field ${error ? 'form-field--error' : ''} ${isOpen ? 'form-field--dropdown-open' : ''} ${className || ''}`.trim()}
            ref={wrapperRef}
        >
            <label htmlFor={selectId} className={hideLabel ? 'sr-only' : 'form-label'}>
                {label}
                {required && <span className="form-required">*</span>}
            </label>

            <div className="form-search-select__input-wrapper">
                <Search size={16} className="form-search-select__icon" />
                <input
                    id={selectId}
                    type="text"
                    className="form-search-select__input"
                    placeholder={placeholder}
                    value={inputValue}
                    autoComplete="off"
                    disabled={disabled}
                    onFocus={() => {
                        if (disableAutoOpen || disabled) return;
                        openDropdown();
                    }}
                    onClick={() => {
                        if (disableAutoOpen) {
                            openDropdown();
                        }
                    }}
                    onChange={event => {
                        if (disabled) return;
                        setSearchTerm(event.target.value);
                        setIsOpen(true);
                        if (onSearch) triggerSearch(event.target.value);
                    }}
                    aria-invalid={!!error}
                />
                {allowClear && value && !disabled && (
                    <button
                        type="button"
                        className="form-search-select__clear"
                        onClick={handleClear}
                        aria-label={`Clear ${label}`}
                    >
                        <X size={14} />
                    </button>
                )}

                {isOpen && !disabled && (
                    <div className="form-search-select__dropdown">
                        {loading ? (
                            <div className="form-search-select__empty">Loading...</div>
                        ) : visibleOptions.length === 0 ? (
                            <div className="form-search-select__empty">{emptyMessage}</div>
                        ) : (
                            visibleOptions.map(option => (
                                <button
                                    key={option.value}
                                    type="button"
                                    className={`form-search-select__option ${value === option.value ? 'form-search-select__option--selected' : ''
                                        } ${option.disabled ? 'form-search-select__option--disabled' : ''}`}
                                    onMouseDown={event => event.preventDefault()}
                                    onClick={() => !option.disabled && handleSelect(option.value)}
                                >
                                    <span>{option.label}</span>
                                </button>
                            ))
                        )}
                    </div>
                )}
            </div>

            {error && <p className="form-error">{error}</p>}
        </div>
    );
}
