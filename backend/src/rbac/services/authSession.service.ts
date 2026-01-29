/**
 * AuthSessionService
 * 
 * Service layer for authentication session management.
 * OWNS: Session lifecycle, session validation, concurrent session limits
 * MUST NOT: Evaluate permissions, manage users, handle authentication logic
 */

import { AuthSessions } from '../models/auth_sessions.model';
import { IAuthSessionsRepository } from '../repositories/auth_sessions.repository';
import { RBACInternalError } from '../errors/rbac.errors';
import crypto from 'node:crypto';

// CONSTANTS
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 Hours
const MAX_CONCURRENT_SESSIONS_PER_USER = 5;

export class ConcurrentSessionLimitError extends RBACInternalError {
    constructor(userId: string) {
        super(`Concurrent session limit exceeded for user ${userId}`);
    }
}

export class SessionNotFoundError extends RBACInternalError {
    constructor(sessionId: string) {
        super(`Session not found: ${sessionId}`);
    }
}

export interface IAuthSessionService {
    /**
     * Get session by ID
     * @throws SessionNotFoundError
     */
    getById(sessionId: string): Promise<AuthSessions>;

    /**
     * List all active sessions for a user
     */
    listActiveByUser(userId: string): Promise<AuthSessions[]>;

    /**
     * List all sessions for a user (active and logged out)
     */
    listAllByUser(userId: string): Promise<AuthSessions[]>;

    /**
     * Create new session
     * @throws ConcurrentSessionLimitError
     */
    create(data: {
        user_id: string;
        ip_address?: string;
        user_agent?: string;
    }): Promise<AuthSessions>;

    /**
     * Update session (e.g., set logout_at)
     * @throws SessionNotFoundError
     */
    update(sessionId: string, data: Partial<AuthSessions>): Promise<AuthSessions>;

    /**
     * Logout session (sets logout_at)
     * @throws SessionNotFoundError
     */
    logout(sessionId: string): Promise<void>;

    /**
     * Revoke session (immediate invalidation)
     * @throws SessionNotFoundError
     */
    revoke(sessionId: string, actingUserId: string): Promise<void>;

    /**
     * Revoke all sessions for a user
     */
    revokeAllByUser(userId: string, actingUserId: string): Promise<void>;

    /**
     * Cleanup expired sessions
     */
    cleanupExpired(): Promise<number>;

    /**
     * Validate session is active and not expired
     */
    isValid(sessionId: string): Promise<boolean>;

    /**
     * Resolve session from ID alone (Global Lookup)
     * Used by Authentication Middleware
     * @throws RBACInternalError (Session Not Found)
     */
    resolveSession(sessionId: string): Promise<AuthSessions>;
}

/**
 * AuthSessionService Implementation
 */
export class AuthSessionService implements IAuthSessionService {
    constructor(private readonly authSessionsRepository: IAuthSessionsRepository) { }

    async getById(sessionId: string): Promise<AuthSessions> {
        const session = await this.authSessionsRepository.findById(sessionId);
        if (!session) {
            throw new SessionNotFoundError(sessionId);
        }
        return session;
    }

    async listActiveByUser(userId: string): Promise<AuthSessions[]> {
        return this.authSessionsRepository.findActiveByUser(userId);
    }

    async listAllByUser(userId: string): Promise<AuthSessions[]> {
        return this.authSessionsRepository.findAllByUser(userId);
    }

    async create(data: {
        user_id: string;
        ip_address?: string;
        user_agent?: string;
    }): Promise<AuthSessions> {
        // Check concurrent session limit
        const activeSessions = await this.authSessionsRepository.findActiveByUser(data.user_id);
        if (activeSessions.length >= MAX_CONCURRENT_SESSIONS_PER_USER) {
            throw new ConcurrentSessionLimitError(data.user_id);
        }

        const now = new Date();
        const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);

        const session = await this.authSessionsRepository.create({
            id: crypto.randomUUID(),
            user_id: data.user_id,
            session_token: crypto.randomUUID(),
            ip_address: data.ip_address || '',
            user_agent: data.user_agent || '',
            login_at: now,
            expires_at: expiresAt,
            logout_at: null
        });

        return session;
    }

    async update(sessionId: string, data: Partial<AuthSessions>): Promise<AuthSessions> {
        // Verify session exists
        await this.getById(sessionId);
        return this.authSessionsRepository.update(sessionId, data);
    }

    async logout(sessionId: string): Promise<void> {
        // Verify session exists
        await this.getById(sessionId);
        await this.authSessionsRepository.update(sessionId, { logout_at: new Date() });
    }

    async revoke(sessionId: string, actingUserId: string): Promise<void> {
        await this.getById(sessionId);
        await this.authSessionsRepository.delete(sessionId, actingUserId);
    }

    async revokeAllByUser(userId: string, _actingUserId: string): Promise<void> {
        await this.authSessionsRepository.deleteAllByUser(userId);
    }

    async cleanupExpired(): Promise<number> {
        // This would require a new repository method to delete expired sessions
        // For now, return 0 as a placeholder
        // In production, implement: DELETE FROM auth_sessions WHERE expires_at < NOW() AND logout_at IS NULL
        return 0;
    }

    async isValid(sessionId: string): Promise<boolean> {
        try {
            const session = await this.authSessionsRepository.findById(sessionId);
            if (!session) return false;
            if (session.logout_at) return false;
            if (new Date() > session.expires_at) return false;
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Resolve session from ID (Global Lookup).
     * Used by authentication middleware.
     * @throws RBACInternalError if session not found or invalid
     */
    async resolveSession(sessionId: string): Promise<AuthSessions> {
        const session = await this.authSessionsRepository.findBySessionIdGlobal(sessionId);

        if (!session) {
            throw new RBACInternalError(`Session not found: ${sessionId}`);
        }

        // Check if session is logged out
        if (session.logout_at) {
            throw new RBACInternalError('Session has been logged out');
        }

        // Check if session is expired
        if (new Date() > session.expires_at) {
            throw new RBACInternalError('Session has expired');
        }

        return session;
    }
}
