/**
 * useSearch Hook
 * 
 * Provides debounced search functionality for filtering data.
 */

import { useState, useEffect, useCallback } from 'react';

export interface UseSearchReturn {
    query: string;
    debouncedQuery: string;
    setQuery: (value: string) => void;
    clearSearch: () => void;
}

export function useSearch(delayMs = 300): UseSearchReturn {
    const [query, setQuery] = useState('');
    const [debouncedQuery, setDebouncedQuery] = useState('');

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedQuery(query);
        }, delayMs);

        return () => clearTimeout(timer);
    }, [query, delayMs]);

    const clearSearch = useCallback(() => {
        setQuery('');
        setDebouncedQuery('');
    }, []);

    return { query, debouncedQuery, setQuery, clearSearch };
}
