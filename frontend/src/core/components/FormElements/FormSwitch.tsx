/**
 * Form Switch Component
 * 
 * Toggle switch for boolean fields.
 */

export interface FormSwitchProps {
    label: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
    disabled?: boolean;
    hint?: string;
    id?: string;
}

export function FormSwitch({
    label,
    checked,
    onChange,
    disabled,
    hint,
    id,
}: FormSwitchProps) {
    const switchId = id || `switch-${label.toLowerCase().replace(/\s+/g, '-')}`;

    return (
        <div className="form-field form-field--switch">
            <div className="form-switch-wrapper">
                <button
                    type="button"
                    id={switchId}
                    role="switch"
                    aria-checked={checked}
                    className={`form-switch ${checked ? 'form-switch--on' : ''}`}
                    onClick={() => !disabled && onChange(!checked)}
                    disabled={disabled}
                >
                    <span className="form-switch__thumb" />
                </button>
                <label htmlFor={switchId} className="form-switch-label">
                    {label}
                </label>
            </div>
            {hint && (
                <p className="form-hint">{hint}</p>
            )}
        </div>
    );
}
