/**
 * useModal Hook
 * 
 * Simple modal state management.
 */

import { useState, useCallback } from 'react';

export interface UseModalReturn<T = unknown> {
    isOpen: boolean;
    data: T | null;
    open: (data?: T) => void;
    close: () => void;
}

export function useModal<T = unknown>(): UseModalReturn<T> {
    const [isOpen, setIsOpen] = useState(false);
    const [data, setData] = useState<T | null>(null);

    const open = useCallback((newData?: T) => {
        setData(newData ?? null);
        setIsOpen(true);
    }, []);

    const close = useCallback(() => {
        setIsOpen(false);
        setData(null);
    }, []);

    return { isOpen, data, open, close };
}
