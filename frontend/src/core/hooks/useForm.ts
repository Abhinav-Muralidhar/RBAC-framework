/**
 * useForm Hook
 * 
 * Generic form state management with validation integration.
 */

import { useState, useCallback, useMemo } from 'react';

export type ValidationFn<T> = (values: T) => Partial<Record<keyof T, string | null>>;

export interface UseFormOptions<T extends Record<string, unknown>> {
    initialValues: T;
    validate?: ValidationFn<T>;
    onSubmit: (values: T) => Promise<void>;
}

export interface UseFormReturn<T extends Record<string, unknown>> {
    values: T;
    errors: Partial<Record<keyof T, string | null>>;
    touched: Partial<Record<keyof T, boolean>>;
    isValid: boolean;
    isSubmitting: boolean;
    isDirty: boolean;
    handleChange: <K extends keyof T>(field: K, value: T[K]) => void;
    handleBlur: (field: keyof T) => void;
    handleSubmit: (e?: React.FormEvent) => Promise<void>;
    setFieldValue: <K extends keyof T>(field: K, value: T[K]) => void;
    setFieldError: (field: keyof T, error: string | null) => void;
    reset: (newValues?: T) => void;
    validateField: (field: keyof T) => string | null;
    validateAll: () => boolean;
}

export function useForm<T extends Record<string, unknown>>({
    initialValues,
    validate,
    onSubmit,
}: UseFormOptions<T>): UseFormReturn<T> {
    const [values, setValues] = useState<T>(initialValues);
    const [errors, setErrors] = useState<Partial<Record<keyof T, string | null>>>({});
    const [touched, setTouched] = useState<Partial<Record<keyof T, boolean>>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    const isDirty = useMemo(() => {
        return JSON.stringify(values) !== JSON.stringify(initialValues);
    }, [values, initialValues]);

    const validateField = useCallback((field: keyof T): string | null => {
        if (!validate) return null;
        const fieldErrors = validate(values);
        return fieldErrors[field] || null;
    }, [validate, values]);

    const validateAll = useCallback((): boolean => {
        if (!validate) return true;
        const newErrors = validate(values);
        setErrors(newErrors);
        return !Object.values(newErrors).some(e => e !== null);
    }, [validate, values]);

    const isValid = useMemo(() => {
        if (!validate) return true;
        const currentErrors = validate(values);
        return !Object.values(currentErrors).some(e => e !== null);
    }, [validate, values]);

    const handleChange = useCallback(<K extends keyof T>(field: K, value: T[K]) => {
        setValues(prev => ({ ...prev, [field]: value }));
        // Clear error on change
        if (errors[field]) {
            setErrors(prev => ({ ...prev, [field]: null }));
        }
    }, [errors]);

    const handleBlur = useCallback((field: keyof T) => {
        setTouched(prev => ({ ...prev, [field]: true }));
        // Validate on blur
        const error = validateField(field);
        if (error) {
            setErrors(prev => ({ ...prev, [field]: error }));
        }
    }, [validateField]);

    const setFieldValue = useCallback(<K extends keyof T>(field: K, value: T[K]) => {
        setValues(prev => ({ ...prev, [field]: value }));
    }, []);

    const setFieldError = useCallback((field: keyof T, error: string | null) => {
        setErrors(prev => ({ ...prev, [field]: error }));
    }, []);

    const handleSubmit = useCallback(async (e?: React.FormEvent) => {
        e?.preventDefault();

        // Mark all fields as touched
        const allTouched = Object.keys(values).reduce((acc, key) => {
            acc[key as keyof T] = true;
            return acc;
        }, {} as Partial<Record<keyof T, boolean>>);
        setTouched(allTouched);

        // Validate all fields
        if (!validateAll()) {
            return;
        }

        setIsSubmitting(true);
        try {
            await onSubmit(values);
        } finally {
            setIsSubmitting(false);
        }
    }, [values, validateAll, onSubmit]);

    const reset = useCallback((newValues?: T) => {
        setValues(newValues || initialValues);
        setErrors({});
        setTouched({});
        setIsSubmitting(false);
    }, [initialValues]);

    return {
        values,
        errors,
        touched,
        isValid,
        isSubmitting,
        isDirty,
        handleChange,
        handleBlur,
        handleSubmit,
        setFieldValue,
        setFieldError,
        reset,
        validateField,
        validateAll,
    };
}
