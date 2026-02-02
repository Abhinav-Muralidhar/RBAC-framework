/**
 * AuthSessionService
 * 
 * Service layer for authentication session management.
 * OWNS: Session lifecycle, session validation, concurrent session limits
 * MUST NOT: Evaluate permissions, manage users, handle authentication logic
 * All mutations are audit logged.
 */

import { AuthSessions } from '../models/auth_sessions.model';
import { IAuthSessionsRepository } from '../repositories/auth_sessions.repository';
import { IAuditService } from './audit.service';
import { RBACInternalError } from '../errors/rbac.errors';
import crypto from 'node:crypto';
import { ConcurrentSessionLimitError, SessionNotFoundError } from '../errors/rbac.errors';

// CONSTANTS
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 Hours
const MAX_CONCURRENT_SESSIONS_PER_USER = 5;



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
     * Resolve session from session_token (Global Lookup)
     * Used by Authentication Middleware
     * @throws RBACInternalError (Session Not Found)
     */
    resolveSession(sessionToken: string): Promise<AuthSessions>;
}

/**
 * AuthSessionService Implementation
 */
export class AuthSessionService implements IAuthSessionService {
    constructor(
        private readonly authSessionsRepository: IAuthSessionsRepository,
        private readonly auditService: IAuditService
    ) { }

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
            user_id: data.user_id,
            session_token: crypto.randomUUID(),
            ip_address: data.ip_address || '',
            user_agent: data.user_agent || '',
            login_at: now,
            expires_at: expiresAt,
            logout_at: null
        });

        // AUDIT: Log session creation (login) (fire-and-forget)
        this.auditService.log({
            user_id: data.user_id,
            action: 'create',
            entity_type: 'session',
            entity_id: session.id,
            old_values: null,
            new_values: {
                ip_address: data.ip_address,
                user_agent: data.user_agent,
                login_at: now.toISOString()
            },
            ip_address: data.ip_address,
            user_agent: data.user_agent,
            status: 'success'
        }).catch(console.error);

        return session;
    }

    async update(sessionId: string, data: Partial<AuthSessions>): Promise<AuthSessions> {
        // Verify session exists
        await this.getById(sessionId);
        return this.authSessionsRepository.update(sessionId, data);
    }

    async logout(sessionId: string): Promise<void> {
        // Verify session exists
        const session = await this.getById(sessionId);
        await this.authSessionsRepository.update(sessionId, { logout_at: new Date() });

        // AUDIT: Log session logout (fire-and-forget)
        this.auditService.log({
            user_id: session.user_id,
            action: 'update',
            entity_type: 'session',
            entity_id: sessionId,
            old_values: { logout_at: null },
            new_values: { logout_at: new Date().toISOString() },
            status: 'success'
        }).catch(console.error);
    }

    async revoke(sessionId: string, actingUserId: string): Promise<void> {
        const session = await this.getById(sessionId);
        await this.authSessionsRepository.delete(sessionId, actingUserId);

        // AUDIT: Log session revocation (fire-and-forget)
        this.auditService.log({
            user_id: actingUserId,
            action: 'delete',
            entity_type: 'session',
            entity_id: sessionId,
            old_values: { ...session } as Record<string, unknown>,
            new_values: { revoked: true, revoked_by: actingUserId },
            status: 'success'
        }).catch(console.error);
    }

    async revokeAllByUser(userId: string, actingUserId: string): Promise<void> {
        // Get session count for audit
        const sessions = await this.authSessionsRepository.findAllByUser(userId);
        const sessionCount = sessions.length;

        await this.authSessionsRepository.deleteAllByUser(userId);

        // AUDIT: Log bulk session revocation (fire-and-forget)
        this.auditService.log({
            user_id: actingUserId,
            action: 'delete',
            entity_type: 'sessions_bulk',
            entity_id: userId,
            old_values: { session_count: sessionCount },
            new_values: { revoked_all: true, target_user_id: userId },
            status: 'success'
        }).catch(console.error);
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
     * Resolve session from session_token (Global Lookup).
     * Used by authentication middleware.
     * @throws RBACInternalError if session not found or invalid
     */
    async resolveSession(sessionToken: string): Promise<AuthSessions> {
        const session = await this.authSessionsRepository.findBySessionToken(sessionToken);

        if (!session) {
            throw new RBACInternalError(`Session not found for token`);
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
