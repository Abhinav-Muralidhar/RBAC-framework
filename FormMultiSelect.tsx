import { useState, useRef, useEffect } from 'react';
import { X, Search, Check } from 'lucide-react';

export interface SelectOption {
    value: string;
    label: string;
    disabled?: boolean;
}

export interface FormMultiSelectProps {
    label: string;
    placeholder?: string;
    options: SelectOption[];
    value: string[];
    onChange: (values: string[]) => void;
    onSearch?: (query: string) => void;
    loading?: boolean;
    error?: string;
    required?: boolean;
    id?: string;
}

export function FormMultiSelect({
    label,
    placeholder = "Search...",
    options,
    value = [],
    onChange,
    onSearch,
    loading,
    error,
    required,
    id,
}: FormMultiSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const wrapperRef = useRef<HTMLDivElement>(null);
    const selectId = id || `multi-select-${label.toLowerCase().replace(/\s+/g, '-')}`;

    // --- FILTERING LOGIC ---
    // We create a specific list for the dropdown that EXCLUDES selected items.
    // We still keep the full 'options' list available to look up labels for the tags.
    const availableOptions = options.filter(opt => !value.includes(opt.value));

    const handleSelect = (optionValue: string) => {
        if (value.includes(optionValue)) {
            onChange(value.filter(v => v !== optionValue));
        } else {
            onChange([...value, optionValue]);
            setSearchTerm('');
        }
    };

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
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
                    onChange={(e) => {
                        setSearchTerm(e.target.value);
                        if (onSearch) onSearch(e.target.value);
                        setIsOpen(true);
                    }}
                    aria-invalid={!!error}
                />

                {/* Dropdown Menu */}
                {isOpen && (
                    <div className="form-multi-select__dropdown">
                        {loading ? (
                            <div className="form-multi-select__empty">Loading...</div>
                        ) : availableOptions.length === 0 ? (
                            // Logic updated: If no available options (because of filter or no results)
                            <div className="form-multi-select__empty">
                                {options.length === 0 ? 'No results found' : ''}
                            </div>
                        ) : (
                            // Map over AVAILABLE options only
                            availableOptions.map(opt => (
                                <div
                                    key={opt.value}
                                    onClick={() => !opt.disabled && handleSelect(opt.value)}
                                    className={`form-multi-select__option 
                                        ${opt.disabled ? 'form-multi-select__option--disabled' : ''}
                                    `}
                                >
                                    <span>{opt.label}</span>
                                    {/* We don't need the checkmark anymore since selected items are gone */}
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