/**
 * Rate Limiting Middleware
 * 
 * Protects the API from abuse with tiered rate limits.
 * Uses in-memory store with automatic cleanup (no Redis required).
 * 
 * Tiers:
 * - Auth: 100 requests per 15 minutes (login, password reset)
 * - Strict: 20 requests per minute (mutations)
 * - Standard: 1000 requests per minute (reads)
 */

import rateLimit from 'express-rate-limit';

const MS_PER_MINUTE = 60 * 1000;
const parseLimit = (envVar: string | undefined, fallback: string) => parseInt(envVar ?? fallback, 10);
const authWindowMs = parseLimit(process.env.RATE_LIMIT_AUTH_WINDOW_MS, '900000'); // 15 minutes
const authMaxRequests = parseLimit(process.env.RATE_LIMIT_AUTH_MAX, '100');
const strictWindowMs = parseLimit(process.env.RATE_LIMIT_STRICT_WINDOW_MS, '60000'); // 1 minute
const strictMaxRequests = parseLimit(process.env.RATE_LIMIT_STRICT_MAX, '20');
const apiWindowMs = parseLimit(process.env.RATE_LIMIT_API_WINDOW_MS, '60000'); // 1 minute
const apiMaxRequests = parseLimit(process.env.RATE_LIMIT_API_MAX, '1000');
const minutesFromWindow = (windowMs: number) => Math.max(1, Math.ceil(windowMs / MS_PER_MINUTE));

/**
 * Standard response envelope for rate limit errors
 */
const createRateLimitMessage = (retryAfterMinutes: number) => ({
    data: null,
    error: {
        message: `Too many requests. Please try again in ${retryAfterMinutes} minute${retryAfterMinutes > 1 ? 's' : ''}.`,
        code: 'RATE_LIMIT_EXCEEDED'
    },
    meta: {
        timestamp: new Date().toISOString()
    }
});

/**
 * Auth rate limiter - for login and password reset
 * Controls how often a single IP can attempt to authenticate.
 * Prevents brute-force attacks (defaults to 100 attempts every 15 minutes).
 */
export const authLimiter = rateLimit({
    windowMs: authWindowMs,
    max: authMaxRequests,
    message: createRateLimitMessage(minutesFromWindow(authWindowMs)),
    standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
    legacyHeaders: false,  // Disable `X-RateLimit-*` headers
    skipSuccessfulRequests: false,
    skipFailedRequests: false
});

/**
 * Strict rate limiter - for mutation operations
 * Prevents rapid data manipulation while still letting valid clients recover.
 */
export const strictLimiter = rateLimit({
    windowMs: strictWindowMs,
    max: strictMaxRequests,
    message: createRateLimitMessage(minutesFromWindow(strictWindowMs)),
    standardHeaders: true,
    legacyHeaders: false
});

/**
 * Standard rate limiter - for read operations
 * Fair usage for normal API access (configurable per environment).
 */
export const standardLimiter = rateLimit({
    windowMs: apiWindowMs,
    max: apiMaxRequests,
    message: createRateLimitMessage(minutesFromWindow(apiWindowMs)),
    standardHeaders: true,
    legacyHeaders: false
});

/**
 * Note on memory cleanup:
 * 
 * express-rate-limit automatically cleans up expired entries.
 * The in-memory store uses a Map with automatic pruning:
 * - Entries are removed when they expire (after windowMs)
 * - No memory leak risk
 * - Suitable for single-server deployments
 * 
 * For multi-server deployments, use rate-limit-redis instead.
 */
