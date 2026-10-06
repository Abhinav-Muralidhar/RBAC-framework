/**
 * Parameter Normalization Utilities
 * 
 * Centralized helpers for strict type narrowing of Express route parameters and query strings.
 * Ensures NO string | string[] | undefined values are passed to service methods.
 * 
 * RULE: All req.params and req.query access MUST go through these helpers.
 */

import { ParamsDictionary, Query } from 'express-serve-static-core';

/**
 * Extract a REQUIRED parameter from req.params
 * @throws Error if parameter is missing or is an array
 * @returns string (guaranteed)
 */
export function getRequiredParam(params: ParamsDictionary, key: string): string {
    const value = params[key];

    if (!value) {
        throw new Error(`Required parameter '${key}' is missing`);
    }

    if (value == undefined) {
        throw new Error(`Required parameter '${key}' is missing`);
    }

    if (typeof value !== 'string') {
        throw new Error(`Parameter '${key}' must be a string, got array`);
    }

    return value;
}

/**
 * Extract an OPTIONAL parameter from req.params
 * @returns string | undefined (never string[])
 */
export function getOptionalParam(params: ParamsDictionary, key: string): string | undefined {
    const value = params[key];

    if (!value) {
        return undefined;
    }

    if (value == undefined) {
        return undefined;
    }

    if (typeof value !== 'string') {
        throw new Error(`Parameter '${key}' must be a string, got array`);
    }

    return value;
}

/**
 * Extract a REQUIRED query parameter from req.query
 * @throws Error if query parameter is missing or is an array
 * @returns string (guaranteed)
 */
export function getRequiredQuery(query: Query, key: string): string {
    const value = query[key];

    if (!value) {
        throw new Error(`Required query parameter '${key}' is missing`);
    }

    if (value == undefined) {
        throw new Error(`Required query parameter '${key}' is missing`);
    }

    if (typeof value !== 'string') {
        throw new Error(`Query parameter '${key}' must be a string, got array`);
    }

    return value;
}

/**
 * Extract an OPTIONAL query parameter from req.query
 * @returns string | undefined (never string[])
 */
export function getOptionalQuery(query: Query, key: string): string | undefined {
    const value = query[key];

    if (!value) {
        return undefined;
    }

    if (typeof value !== 'string') {
        throw new Error(`Query parameter '${key}' must be a string, got array`);
    }

    return value;
}

// ============================================================================
// HIGH-LEVEL ROUTE HELPERS
// ============================================================================

/**
 * Parse and validate an ID parameter from Express params
 * Handles the string | string[] | undefined type from req.params
 */
export function parseId(value: string | string[] | undefined, paramName: string): string {
    if (value === undefined || value === null) {
        throw new Error(`${paramName} is required`);
    }

    if (Array.isArray(value)) {
        throw new Error(`${paramName} must be a single value, got array`);
    }

    const trimmed = value.trim();
    if (trimmed === '') {
        throw new Error(`${paramName} is required`);
    }

    return trimmed;
}

/**
 * Parse pagination parameters from query string
 * Provides safe defaults and validates bounds
 */
export function parsePagination(query: Query): { page: number; limit: number } {
    const pageStr = getOptionalQuery(query, 'page');
    const limitStr = getOptionalQuery(query, 'limit');

    const page = Math.max(1, parseInt(pageStr ?? '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(limitStr ?? '20', 10) || 20));

    return { page, limit };
}

export function parseBooleanQuery(query: Query, key: string): boolean | undefined {
    const value = getOptionalQuery(query, key);
    if (value === undefined) {
        return undefined;
    }
    if (value === 'true') {
        return true;
    }
    if (value === 'false') {
        return false;
    }
    throw new Error(`Query parameter '${key}' must be 'true' or 'false'`);
}

export function getBodyObject(input: unknown): Record<string, unknown> {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
        throw new Error('Request body must be an object');
    }
    return input as Record<string, unknown>;
}

export function getRequiredBodyString(input: unknown, key: string): string {
    const body = getBodyObject(input);
    const value = body[key];
    if (typeof value !== 'string' || value.trim() === '') {
        throw new Error(`${key} is required`);
    }
    return value.trim();
}

export function getOptionalBodyString(input: unknown, key: string): string | undefined {
    const body = getBodyObject(input);
    const value = body[key];
    if (value === undefined || value === null) {
        return undefined;
    }
    if (typeof value !== 'string') {
        throw new Error(`${key} must be a string`);
    }
    const trimmed = value.trim();
    return trimmed === '' ? undefined : trimmed;
}

export function getRequiredBodyNumber(input: unknown, key: string): number {
    const body = getBodyObject(input);
    const value = body[key];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new Error(`${key} must be a number`);
    }
    return value;
}

export function getRequiredBodyBoolean(input: unknown, key: string): boolean {
    const body = getBodyObject(input);
    const value = body[key];
    if (typeof value !== 'boolean') {
        throw new Error(`${key} must be a boolean`);
    }
    return value;
}

export function pickAllowedFields<T extends object, K extends keyof T>(
    input: unknown,
    allowedKeys: readonly K[]
): Partial<Pick<T, K>> {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
        return {};
    }

    const source = input as Record<string, unknown>;
    const result: Partial<Pick<T, K>> = {};

    for (const key of allowedKeys) {
        if (Object.prototype.hasOwnProperty.call(source, key as string)) {
            (result as Record<string, unknown>)[key as string] = source[key as string];
        }
    }

    return result;
}
