// core/hooks/usePaginatedData.ts
import { useCallback, useEffect, useMemo, useState } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PaginatedResponse } from '../api/client';

const LIMIT_OPTIONS = [10, 25, 50];

function normalizeLimit(value: number | undefined | null): number {
    if (!value) return LIMIT_OPTIONS[0];
    return LIMIT_OPTIONS.includes(value) ? value : LIMIT_OPTIONS[0];
}

export type FilterValue = string | number | boolean | undefined;

export interface PaginationParams {
    page?: number;
    limit?: number;
    search?: string;
}

export interface UsePaginatedDataResult<T> {
    data: T[];
    isLoading: boolean;
    isInitialLoading: boolean;
    isPlaceholderData: boolean;
    error: string;
    page: number;
    totalPages: number;
    limit: number;
    total: number;
    limitOptions: number[];
    searchQuery: string;
    filters: Record<string, FilterValue>;
    draftFilters: Record<string, FilterValue>;
    reload: () => Promise<void>;
    setPage: (page: number) => void;
    setLimit: (limit: number) => void;
    setSearchQuery: (query: string) => void;
    setFilters: (filters: Record<string, FilterValue>) => void;
    setDraftFilters: (filters: Record<string, FilterValue>) => void;
    filterModal: {
        isOpen: boolean;
        open: () => void;
        close: () => void;
        submit: () => void;
    };
}

export interface PaginatedSource<T> {
    fetchFn: (params: PaginationParams & Record<string, FilterValue>) => Promise<PaginatedResponse<T>>;
    sourceKey: string;
}

export function createPaginatedSource<T>(
    sourceKey: string,
    fetchFn: (params: PaginationParams & Record<string, FilterValue>) => Promise<PaginatedResponse<T>>
): PaginatedSource<T> {
    return { fetchFn, sourceKey };
}

export function usePaginatedData<T>(
    source: PaginatedSource<T> | ((params: PaginationParams & Record<string, FilterValue>) => Promise<PaginatedResponse<T>>),
    options: {
        initialFilters?: Record<string, FilterValue>;
        debounceMs?: number;
        sourceKey?: string;
    } = {}
): UsePaginatedDataResult<T> {
    const { initialFilters = {}, debounceMs = 500, sourceKey } = options;
    const fetchFn = typeof source === 'function' ? source : source.fetchFn;
    const resolvedSourceKey = sourceKey ?? (typeof source === 'function' ? undefined : source.sourceKey);
    const queryClient = useQueryClient();

    const limitOptions = [...LIMIT_OPTIONS];
    const defaultLimit = LIMIT_OPTIONS[0];

    const [page, setPage] = useState(1);
    const [limit, setLimitState] = useState(defaultLimit);
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [filters, setFilters] = useState<Record<string, FilterValue>>(initialFilters);
    const [draftFilters, setDraftFilters] = useState<Record<string, FilterValue>>(initialFilters);
    const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

    const activeFilterEntries = useMemo(
        () =>
            Object.entries(filters)
                .filter(([, value]) => value !== undefined)
                .sort(([left], [right]) => left.localeCompare(right)),
        [filters]
    );

    const queryKeyBase = useMemo(
        () => ['rbac', resolvedSourceKey ?? 'paginated'] as const,
        [resolvedSourceKey]
    );

    const queryKey = useMemo(
        () => [...queryKeyBase, page, limit, debouncedSearch, activeFilterEntries] as const,
        [queryKeyBase, page, limit, debouncedSearch, activeFilterEntries]
    );

    const query = useQuery<PaginatedResponse<T>, Error>({
        queryKey,
        queryFn: () =>
            fetchFn({
                page,
                limit,
                search: debouncedSearch || undefined,
                ...filters,
            }),
        placeholderData: keepPreviousData,
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: 1,
    });

    const responseData = query.data?.data ?? [];
    const pagination = query.data?.meta ?? {
        page,
        limit,
        total: responseData.length,
        totalPages: 1,
    };

    useEffect(() => {
        if (!query.data) {
            return;
        }

        const nextPage = pagination.page + 1;
        if (nextPage > pagination.totalPages) {
            return;
        }

        void queryClient.prefetchQuery({
            queryKey: [...queryKeyBase, nextPage, limit, debouncedSearch, activeFilterEntries] as const,
            queryFn: () =>
                fetchFn({
                    page: nextPage,
                    limit,
                    search: debouncedSearch || undefined,
                    ...filters,
                }),
            staleTime: 30_000,
        });
    }, [activeFilterEntries, debouncedSearch, fetchFn, limit, pagination.page, pagination.totalPages, query.data, queryClient, queryKeyBase, filters]);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchQuery);
            setPage(1);
        }, debounceMs);

        return () => clearTimeout(timer);
    }, [searchQuery, debounceMs]);

    const handleSetFilters = useCallback((newFilters: Record<string, FilterValue>) => {
        setFilters(newFilters);
        setPage(1);
    }, []);

    const applyFilters = useCallback(() => {
        setFilters(draftFilters);
        setPage(1);
    }, [draftFilters]);

    const resetDraftFilters = useCallback(() => {
        setDraftFilters(filters);
    }, [filters]);

    const openFilterModal = useCallback(() => {
        resetDraftFilters();
        setIsFilterModalOpen(true);
    }, [resetDraftFilters]);

    const closeFilterModal = useCallback(() => {
        setIsFilterModalOpen(false);
    }, []);

    const submitFilterModal = useCallback(() => {
        applyFilters();
        setIsFilterModalOpen(false);
    }, [applyFilters]);

    const handleSetLimit = useCallback((nextLimit: number) => {
        const normalized = normalizeLimit(nextLimit);
        setLimitState(normalized);
        setPage(1);
    }, []);

    const reload = useCallback(async () => {
        await queryClient.invalidateQueries({ queryKey: queryKeyBase });
    }, [queryClient, queryKeyBase]);

    return {
        data: responseData,
        isLoading: query.isFetching,
        isInitialLoading: query.isPending,
        isPlaceholderData: query.isPlaceholderData,
        error: query.error?.message ?? '',
        page,
        totalPages: pagination.totalPages || 1,
        limit,
        total: pagination.total || 0,
        limitOptions,
        searchQuery,
        filters,
        draftFilters,
        reload,
        setPage,
        setLimit: handleSetLimit,
        setSearchQuery,
        setFilters: handleSetFilters,
        setDraftFilters,
        filterModal: {
            isOpen: isFilterModalOpen,
            open: openFilterModal,
            close: closeFilterModal,
            submit: submitFilterModal
        }
    };
}
