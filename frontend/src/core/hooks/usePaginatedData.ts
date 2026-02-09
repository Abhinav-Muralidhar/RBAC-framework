// core/hooks/usePaginatedData.ts
import { useState, useEffect, useCallback, useRef } from 'react';

export interface PaginationParams {
    page?: number;
    limit?: number;
    search?: string;
    [key: string]: any; // For filters
}

export interface UsePaginatedDataResult<T> {
    data: T[];
    isLoading: boolean;
    error: string;
    page: number;
    totalPages: number;
    limit: number;
    total: number;
    searchQuery: string;
    filters: Record<string, any>;
    reload: () => void;
    setPage: (page: number) => void;
    setLimit: (limit: number) => void;
    setSearchQuery: (query: string) => void;
    setFilters: (filters: Record<string, any>) => void;
}

export function usePaginatedData<T>(
    fetchFn: (params: PaginationParams) => Promise<any>,
    options: {
        initialLimit?: number;
        initialFilters?: Record<string, any>;
        debounceMs?: number;
    } = {}
): UsePaginatedDataResult<T> {
    const { initialLimit = 20, initialFilters = {}, debounceMs = 500 } = options;

    const [data, setData] = useState<T[]>([]);
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(initialLimit);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [filters, setFilters] = useState<Record<string, any>>(initialFilters);

    // Track if search change should reset page
    const isFirstRender = useRef(true);

    // Debounce search query
    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }
        const timer = setTimeout(() => {
            setDebouncedSearch(searchQuery);
            setPage(1); // Reset to page 1 on search change
        }, debounceMs);
        return () => clearTimeout(timer);
    }, [searchQuery, debounceMs]);

    const loadData = useCallback(async () => {
        setIsLoading(true);
        setError('');
        try {
            const params: PaginationParams = {
                page,
                limit,
                search: debouncedSearch || undefined,
                ...filters
            };
            const response = await fetchFn(params);

            const { data: responseData = [], meta } = response;
            const pagination = meta ?? {
                page: 1,
                limit,
                total: responseData.length,
                totalPages: 1,
            };

            setData(responseData);
            setTotalPages(pagination.totalPages || 1);
            setTotal(pagination.total || 0);
            setPage(pagination.page ?? page);
            setLimit(pagination.limit ?? limit);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load data');
        } finally {
            setIsLoading(false);
        }
    }, [fetchFn, page, limit, debouncedSearch, filters]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleSetFilters = useCallback((newFilters: Record<string, any>) => {
        setFilters(newFilters);
        setPage(1); // Reset to page 1 on filter change
    }, []);

    return {
        data,
        isLoading,
        error,
        page,
        totalPages,
        limit,
        total,
        searchQuery,
        filters,
        reload: loadData,
        setPage,
        setLimit,
        setSearchQuery,
        setFilters: handleSetFilters
    };
}