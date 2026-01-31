/**
 * Rate Limiting Middleware
 * 
 * Protects the API from abuse with tiered rate limits.
 * Uses in-memory store with automatic cleanup (no Redis required).
 * 
 * Tiers:
 * - Auth: 5 requests per 15 minutes (login, password reset)
 * - Strict: 20 requests per minute (mutations)
 * - Standard: 100 requests per minute (reads)
 */

import rateLimit from 'express-rate-limit';

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
 * Very strict: 5 requests per 15 minutes
 * Prevents brute-force attacks
 */
export const authLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_AUTH_WINDOW_MS || '900000', 10), // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_AUTH_MAX || '5', 10),
    message: createRateLimitMessage(15),
    standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
    legacyHeaders: false,  // Disable `X-RateLimit-*` headers
    skipSuccessfulRequests: false,
    skipFailedRequests: false
});

/**
 * Strict rate limiter - for mutation operations
 * 20 requests per minute
 * Prevents rapid data manipulation
 */
export const strictLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 20,
    message: createRateLimitMessage(1),
    standardHeaders: true,
    legacyHeaders: false
});

/**
 * Standard rate limiter - for read operations
 * 100 requests per minute
 * Fair usage for normal API access
 */
export const standardLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_API_WINDOW_MS || '60000', 10), // 1 minute
    max: parseInt(process.env.RATE_LIMIT_API_MAX || '100', 10),
    message: createRateLimitMessage(1),
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
