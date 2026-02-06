// core/hooks/usePaginatedData.ts
import { useState, useEffect, useCallback } from 'react';

export interface PaginationParams {
    page?: number;
    limit?: number;
}

export interface UsePaginatedDataResult<T> {
    data: T[];
    isLoading: boolean;
    error: string;
    page: number;
    totalPages: number;
    limit: number;
    reload: () => void;
    setPage: (page: number) => void;
    setLimit: (limit: number) => void;
}

export function usePaginatedData<T>(
    fetchFn: (params: PaginationParams) => Promise<any>,
    defaultLimit = 20
): UsePaginatedDataResult<T> {
    const [data, setData] = useState<T[]>([]);
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(defaultLimit);
    const [totalPages, setTotalPages] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');


    const loadData = useCallback(async () => {
        setIsLoading(true);
        setError('');
        try {
            const response = await fetchFn({ page, limit });
            const items = response.data ?? response.data?.data ?? [];
            const pagination = response.meta?.pagination ?? {
                page: 1,
                limit,
                total: items.length,
                totalPages: 1,
            };
            const responseData = Array.isArray(response.data?.data) ? response.data.data : [];

            setData(responseData);
            setTotalPages(pagination.totalPages);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load data');
        } finally {
            setIsLoading(false);
        }
    }, [fetchFn, page, limit]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    return { data, isLoading, error, page, totalPages, limit, reload: loadData, setPage, setLimit };
}
