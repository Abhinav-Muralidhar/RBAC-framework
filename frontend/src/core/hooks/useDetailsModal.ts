/**
 * useDetailsModal Hook
 *
 * Manages open/close state and the selected entity ID for the DetailsModal.
 */

import { useState, useCallback } from 'react';

export interface UseDetailsModalReturn {
    isOpen: boolean;
    selectedId: string | null;
    open: (id: string | number) => void;
    close: () => void;
}

export function useDetailsModal(): UseDetailsModalReturn {
    const [isOpen, setIsOpen] = useState(false);
    const [selectedId, setSelectedId] = useState<string | null>(null);

    const open = useCallback((id: string | number) => {
        setSelectedId(String(id));
        setIsOpen(true);
    }, []);

    const close = useCallback(() => {
        setIsOpen(false);
        setSelectedId(null);
    }, []);

    return { isOpen, selectedId, open, close };
}
