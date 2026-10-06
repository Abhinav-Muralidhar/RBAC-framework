/**
 * API Error Helpers
 *
 * Standardized, production-grade error shape for HTTP APIs.
 */

export interface ApiErrorOptions {
    details?: unknown;
    expose?: boolean;
    cause?: Error;
}

export class ApiError extends Error {
    public readonly statusCode: number;
    public readonly code: string;
    public readonly details?: unknown;
    public readonly expose: boolean;

    constructor(statusCode: number, code: string, message: string, options?: ApiErrorOptions) {
        super(message);
        this.name = 'ApiError';
        this.statusCode = statusCode;
        this.code = code;
        this.details = options?.details;
        this.expose = options?.expose ?? statusCode < 500;

        if (options?.cause) {
            (this as { cause?: Error }).cause = options.cause;
        }
        Error.captureStackTrace(this, this.constructor);
    }
}

export const badRequest = (message: string, code = 'BAD_REQUEST', details?: unknown) =>
    new ApiError(400, code, message, { details, expose: true });

export const unauthorized = (message: string, code = 'UNAUTHORIZED', details?: unknown) =>
    new ApiError(401, code, message, { details, expose: true });

export const forbidden = (message: string, code = 'FORBIDDEN', details?: unknown) =>
    new ApiError(403, code, message, { details, expose: true });

export const notFound = (message: string, code = 'NOT_FOUND', details?: unknown) =>
    new ApiError(404, code, message, { details, expose: true });

export const conflict = (message: string, code = 'CONFLICT', details?: unknown) =>
    new ApiError(409, code, message, { details, expose: true });

export const tooManyRequests = (message: string, code = 'TOO_MANY_REQUESTS', details?: unknown) =>
    new ApiError(429, code, message, { details, expose: true });

export const payloadTooLarge = (message: string, code = 'PAYLOAD_TOO_LARGE', details?: unknown) =>
    new ApiError(413, code, message, { details, expose: true });

export const internalError = (message: string, code = 'INTERNAL_ERROR', details?: unknown) =>
    new ApiError(500, code, message, { details, expose: false });
