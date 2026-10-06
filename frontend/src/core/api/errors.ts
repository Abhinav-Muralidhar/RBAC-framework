/**
 * Structured API Error
 *
 * Preserves the full backend error envelope so downstream code
 * can branch on status, code, or field-level details.
 */

export class ApiError extends Error {
    /** HTTP status code (e.g. 400, 401, 403, 404, 409, 500) */
    readonly status: number;
    /** Machine-readable error code from the backend (e.g. "INVALID_INPUT", "PERMISSION_DENIED") */
    readonly code: string;
    /** Optional structured details (validation errors, field-level info) */
    readonly details?: unknown;

    constructor(status: number, code: string, message: string, details?: unknown) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.code = code;
        this.details = details;

        // Maintain proper prototype chain for instanceof checks
        Object.setPrototypeOf(this, ApiError.prototype);
    }

    /** True when the error is an authentication failure (401) */
    get isAuthError(): boolean {
        return this.status === 401;
    }

    /** True when the error is a permission/authorization failure (403) */
    get isForbidden(): boolean {
        return this.status === 403;
    }

    /** True when the error is a validation / bad-request failure (400) */
    get isValidationError(): boolean {
        return this.status === 400;
    }

    /** True when the error is a not-found failure (404) */
    get isNotFound(): boolean {
        return this.status === 404;
    }

    /** True when the error is a conflict failure (409) */
    get isConflict(): boolean {
        return this.status === 409;
    }
}

/**
 * Type-guard: narrows `unknown` to `ApiError`.
 */
export function isApiError(err: unknown): err is ApiError {
    return err instanceof ApiError;
}

/**
 * Extract a user-friendly message from any error shape.
 * Prefer `ApiError.message`, fall back to generic `Error.message`,
 * and finally a static fallback.
 */
export function getErrorMessage(err: unknown, fallback = 'An unexpected error occurred'): string {
    if (isApiError(err)) {
        if (err.status === 413) {
            return 'The uploaded file is too large. Please try a smaller file.';
        }
        return err.message;
    }
    if (err instanceof Error) return err.message;
    if (typeof err === 'string') return err;
    return fallback;
}
