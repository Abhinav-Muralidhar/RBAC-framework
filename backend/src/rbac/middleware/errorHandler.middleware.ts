/**
 * Global Error Handler Middleware
 * 
 * Catches all unhandled errors and returns a standardized error response.
 */

import { Request, Response, NextFunction } from 'express';
import { PermissionDeniedError, RBACError } from '../errors/rbac.errors';
import { SessionNotFoundError, ConcurrentSessionLimitError } from '../services/authSession.service';

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

/**
 * Map known error types to HTTP status codes
 */
function getStatusCode(error: Error): number {
    if (error instanceof PermissionDeniedError) return 403;
    if (error instanceof SessionNotFoundError) return 401;
    if (error instanceof ConcurrentSessionLimitError) return 429;

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
function getErrorCode(error: Error): string {
    if (error instanceof PermissionDeniedError) return 'PERMISSION_DENIED';
    if (error instanceof SessionNotFoundError) return 'INVALID_SESSION';
    if (error instanceof ConcurrentSessionLimitError) return 'TOO_MANY_SESSIONS';

    // Check for "not found" errors by class name pattern
    if (error instanceof RBACError && error.constructor.name.includes('NotFound')) return 'NOT_FOUND';

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

    // Log internal errors
    if (statusCode >= 500) {
        console.error('Internal Server Error:', error);
    }

    // Get request ID if present
    const requestIdHeader = req.headers['x-request-id'];
    const requestId = typeof requestIdHeader === 'string' ? requestIdHeader : undefined;

    const response: ErrorResponse = {
        data: null,
        error: {
            message: statusCode >= 500 ? 'An unexpected error occurred' : error.message,
            code: errorCode,
            details: process.env.NODE_ENV === 'development' && statusCode >= 500
                ? { stack: error.stack }
                : undefined
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
