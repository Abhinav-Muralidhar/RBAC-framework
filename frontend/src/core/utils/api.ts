// core/utils/api.ts
export interface Pagination {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

export interface PaginatedResponse<T> {
    data: T[];
    meta: {
        pagination: Pagination;
    };
    error: string | null;
}

export function extractPaginatedData<T>(
    response: any,
    defaultLimit = 20
): PaginatedResponse<T> {
    const data = response?.data ?? [];
    const pagination = response?.meta?.pagination ?? {
        page: 1,
        limit: defaultLimit,
        total: data.length,
        totalPages: 1,
    };

    return {
        data,
        meta: { pagination },
        error: response?.error ?? null,
    };
}
