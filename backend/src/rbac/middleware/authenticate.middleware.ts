/**
 * Authenticate Middleware
 * 
 * SINGLE SOURCE OF TRUTH for Request Context.
 * 
 * Responsibilities:
 * 1. Read 'sessionToken' cookie (HTTP Only)
 * 2. Resolve Session via AuthSessionService (Global Lookup)
 * 3. Populate req.user = { id, sessionId }
 * 4. Fail Closed on any error
 */

import { Request, Response, NextFunction } from 'express';
import { IAuthSessionService } from '../services/authSession.service';
import { unauthorized } from '../errors/api.errors';

// Session TTL for sliding expiration (24 hours)
const SESSION_EXTEND_MS = 24 * 60 * 60 * 1000;

/**
 * Creates the main authentication middleware.
 * Verifies session exists and populates req.user.
 */
export function createAuthenticateMiddleware(authSessionService: IAuthSessionService) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            // 1. Read Signed Cookie (tamper-proof)
            // If cookie was tampered with, signedCookies[key] will be false
            const sessionToken = req.signedCookies['sessionToken'];

            if (!sessionToken || sessionToken === false) {
                return next(unauthorized('Authentication required', 'AUTH_REQUIRED'));
            }
            const session = await authSessionService.resolveSession(undefined, sessionToken);

            if (!session) {
                return next(unauthorized('Invalid or expired session', 'INVALID_SESSION'));
            }

            req.user = {
                id: session.user_id,
                sessionId: session.id
            };


            next();

        } catch (error: any) {
            // Expected auth failures (logged out, expired, not found) — warn only
            const msg = error?.message ?? '';
            if (msg.includes('logged out') || msg.includes('expired') || msg.includes('not found')) {
                console.warn(`Auth rejected: ${msg}`);
            } else {
                // Unexpected error — log full trace
                console.error('Authentication Failed:', error);
            }

            return next(unauthorized('Invalid or expired session', 'INVALID_SESSION'));
        }
    };
}

/**
 * Creates middleware that validates session is still active and extends expiry.
 * 
 * This should be used AFTER createAuthenticateMiddleware.
 * On each valid request, extends the session expiry by 24 hours (sliding expiration).
 */
export function createRequireActiveSessionMiddleware(authSessionService: IAuthSessionService) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            // Must have user from authenticate middleware
            if (!req.user?.sessionId) {
                return next(unauthorized('No session context', 'NO_SESSION'));
            }

            // Check if session is still active (not logged out, not expired)
            const isActive = await authSessionService.isValid(undefined, req.user.sessionId);
            if (!isActive) {
                return next(unauthorized('Your session has expired. Please log in again.', 'SESSION_EXPIRED'));
            }

            // Extend session expiry by 24 hours (sliding expiration)
            const newExpiry = new Date(Date.now() + SESSION_EXTEND_MS);
            await authSessionService.update(undefined, req.user.sessionId, { expires_at: newExpiry });

            next();

        } catch (error) {
            console.error('Session validation failed:', error);
            return next(unauthorized('Session validation failed', 'SESSION_CHECK_FAILED'));
        }
    };
}
