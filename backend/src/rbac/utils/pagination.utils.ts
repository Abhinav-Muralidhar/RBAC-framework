/**
 * Pagination Utilities
 * 
 * Centralized pagination helpers for RBAC repositories.
 */

/**
 * Pagination request parameters
 */
export interface PaginationParams {
    page: number;   // 1-indexed
    limit: number;  // max 100
}

/**
 * Paginated result wrapper
 */
export interface PaginatedResult<T> {
    data: T[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

/**
 * Default pagination values
 */
export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

/**
 * Calculate offset for SQL query from page/limit
 */
export function getPaginationOffset(page: number, limit: number): number {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(Math.max(1, limit), MAX_LIMIT);
    return (safePage - 1) * safeLimit;
}

/**
 * Normalize pagination params with defaults
 */
export function normalizePaginationParams(params?: Partial<PaginationParams>): PaginationParams {
    return {
        page: Math.max(1, params?.page ?? DEFAULT_PAGE),
        limit: Math.min(Math.max(1, params?.limit ?? DEFAULT_LIMIT), MAX_LIMIT)
    };
}

/**
 * Build paginated result from data and total count
 */
export function buildPaginatedResult<T>(
    data: T[],
    total: number,
    params: PaginationParams
): PaginatedResult<T> {
    const page = Math.max(1, params.page);
    const safeLimit = Math.min(Math.max(1, params.limit), MAX_LIMIT);
    return {
        data,
        pagination: {
            page: page,
            limit: safeLimit,
            total,
            totalPages: Math.ceil(total / safeLimit)
        }
    };
}
