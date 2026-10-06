/**
 * Global Error Handler Middleware
 * 
 * Catches all unhandled errors and returns a standardized error response.
 */

import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../errors/api.errors';
import {
    AccessDeniedError,
    ConcurrentModificationError,
    CircularRoleHierarchyError,
    ConcurrentSessionLimitError,
    InvalidModuleActionError,
    InvalidPasswordError,
    InvalidStateError,
    PermissionDeniedError,
    RBACError,
    RBACInternalError,
    RoleHasActiveChildrenError,
    SessionNotFoundError,
    SMTPConfigError,
    SMTPConfigNotFoundError,
    SoftDeletedEntityError
} from '../errors/rbac.errors';
/**
 * Standard error response
 */
interface ErrorResponse {
    data: null;
    error: {
        message: string;
        code: string;
        details?: unknown;
    };
    meta: {
        timestamp: string;
        requestId?: string;
    };
}

function getPgCode(error: Error): string | undefined {
    const dbError = error as Error & { code?: string };
    return typeof dbError.code === 'string' ? dbError.code : undefined;
}

function getUniqueViolationDetails(error: Error): { constraint?: string; detail?: string } | undefined {
    const dbError = error as Error & { constraint?: string; detail?: string };
    const code = getPgCode(error);
    if (code !== '23505') {
        return undefined;
    }

    const details: { constraint?: string; detail?: string } = {};
    if (dbError.constraint) {
        details.constraint = dbError.constraint;
    }
    if (dbError.detail) {
        details.detail = dbError.detail;
    }
    return details;
}

/**
 * Map known error types to HTTP status codes
 */
function getExplicitStatus(error: Error): number | undefined {
    const errorWithStatus = error as unknown as { status?: unknown; statusCode?: unknown };
    const status = typeof errorWithStatus.status === 'number'
        ? errorWithStatus.status
        : typeof errorWithStatus.statusCode === 'number'
            ? errorWithStatus.statusCode
            : undefined;
    if (status && status >= 100 && status < 600) return status;
    return undefined;
}

function getStatusCode(error: Error): number {
    if (error instanceof ApiError) return error.statusCode;

    if (getPgCode(error) === '23505') return 409;

    const explicitStatus = getExplicitStatus(error);
    if (explicitStatus) return explicitStatus;

    if (error instanceof PermissionDeniedError || error instanceof AccessDeniedError) return 403;
    if (error instanceof SessionNotFoundError) return 401;
    if (error instanceof ConcurrentSessionLimitError) return 429;
    if (error instanceof ConcurrentModificationError) return 409;
    if (error instanceof InvalidModuleActionError) return 400;
    if (error instanceof InvalidPasswordError) return 400;
    if (error instanceof InvalidStateError) return 409;
    if (error instanceof RoleHasActiveChildrenError) return 409;
    if (error instanceof CircularRoleHierarchyError) return 409;
    if (error instanceof SoftDeletedEntityError) return 410;
    if (error instanceof SMTPConfigNotFoundError) return 404;
    if (error instanceof SMTPConfigError) return 400;
    if (error instanceof RBACInternalError) return 500;

    // Check for "not found" errors by class name pattern
    if (error instanceof RBACError && error.constructor.name.includes('NotFound')) return 404;

    // Check for "not found" errors by message
    if (error.message.toLowerCase().includes('not found')) return 404;

    // Check for authentication errors by message
    if (error.message.toLowerCase().includes('session') &&
        (error.message.toLowerCase().includes('invalid') ||
            error.message.toLowerCase().includes('expired'))) return 401;

    // Check for inactive user
    if (error.message.toLowerCase().includes('inactive')) return 403;

    // Check for validation errors
    if (error.message.toLowerCase().includes('invalid') ||
        error.message.toLowerCase().includes('required') ||
        error.message.toLowerCase().includes('must be')) return 400;

    return 500;
}

/**
 * Map known error types to error codes
 */
function toErrorCodeFromName(name: string): string {
    return name
        .replace(/Error$/, '')
        .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
        .toUpperCase();
}

function getErrorCode(error: Error): string {
    if (error instanceof ApiError) return error.code;

    if (getPgCode(error) === '23505') return 'UNIQUE_VIOLATION';

    const errorWithCode = error as unknown as { code?: unknown };
    const explicitCode = typeof errorWithCode.code === 'string'
        ? errorWithCode.code
        : undefined;
    if (explicitCode) return explicitCode;

    if (error instanceof PermissionDeniedError) return 'PERMISSION_DENIED';
    if (error instanceof SessionNotFoundError) return 'INVALID_SESSION';
    if (error instanceof ConcurrentSessionLimitError) return 'TOO_MANY_SESSIONS';
    if (error instanceof ConcurrentModificationError) return 'CONCURRENT_MODIFICATION';

    // Check for "not found" errors by class name pattern
    if (error instanceof RBACError && error.constructor.name.includes('NotFound')) {
        return toErrorCodeFromName(error.name);
    }

    if (error instanceof RBACError) {
        return toErrorCodeFromName(error.name);
    }

    if (error.message.toLowerCase().includes('not found')) return 'NOT_FOUND';
    if (error.message.toLowerCase().includes('session') && error.message.toLowerCase().includes('invalid')) return 'INVALID_SESSION';
    if (error.message.toLowerCase().includes('session') && error.message.toLowerCase().includes('expired')) return 'SESSION_EXPIRED';
    if (error.message.toLowerCase().includes('inactive')) return 'USER_INACTIVE';
    if (error.message.toLowerCase().includes('invalid')) return 'INVALID_INPUT';
    if (error.message.toLowerCase().includes('required')) return 'MISSING_REQUIRED_FIELD';

    return 'INTERNAL_ERROR';
}

/**
 * Global error handler middleware
 */
export function errorHandler(
    error: Error,
    req: Request,
    res: Response,
    _next: NextFunction
): void {
    const statusCode = getStatusCode(error);
    const errorCode = getErrorCode(error);
    const isApiError = error instanceof ApiError;
    const exposeMessage = isApiError ? error.expose : statusCode < 500;

    // Log internal errors
    if (statusCode >= 500) {
        console.error('Internal Server Error:', error);
    }

    // Get request ID if present
    const requestId = req.requestId;

    const response: ErrorResponse = {
        data: null,
        error: {
            message: getPgCode(error) === '23505'
                ? 'A record with the same unique value already exists'
                : exposeMessage ? error.message : 'An unexpected error occurred',
            code: errorCode,
            details: getUniqueViolationDetails(error)
                ?? (isApiError && error.details !== undefined && exposeMessage
                ? error.details
                : process.env.NODE_ENV === 'development' && statusCode >= 500
                    ? { stack: error.stack }
                    : undefined)
        },
        meta: requestId
            ? { timestamp: new Date().toISOString(), requestId }
            : { timestamp: new Date().toISOString() }
    };

    res.status(statusCode).json(response);
}

/**
 * 404 Not Found handler for unknown routes
 */
export function notFoundHandler(req: Request, res: Response): void {
    res.status(404).json({
        data: null,
        error: {
            message: `Route not found: ${req.method} ${req.path}`,
            code: 'ROUTE_NOT_FOUND'
        },
        meta: {
            timestamp: new Date().toISOString()
        }
    });
}
