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
