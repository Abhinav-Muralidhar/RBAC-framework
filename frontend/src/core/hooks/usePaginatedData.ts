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
            console.log('API response:', response);  // Log the response

            const { data: responseData = [], meta } = response;
            const pagination = meta ?? {
                page: 1,
                limit,
                total: responseData.length,
                totalPages: 1,
            };

            console.log('Pagination data:', pagination); // Log pagination data

            setData(responseData);
            setTotalPages(pagination.totalPages);
            setPage(pagination.page ?? 1);
            setLimit(pagination.limit ?? limit);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load data');
        } finally {
            setIsLoading(false);
        }
    }, [fetchFn, page, limit]);

    useEffect(() => {
        loadData();
    }, [loadData, page, limit]);

    return { data, isLoading, error, page, totalPages, limit, reload: loadData, setPage, setLimit };
}