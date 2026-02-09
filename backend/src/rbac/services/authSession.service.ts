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
import { PaginatedResult } from '../utils/pagination.utils';
import { IEvaluationService } from './evaluation.service';
import { IDatabase } from 'pg-promise';
import { TransactionTask } from '../utils/transaction.utils';

// CONSTANTS
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 Hours
const MAX_CONCURRENT_SESSIONS_PER_USER = 5;
const MODULE_CODE = 'SETTINGS';


export interface IAuthSessionService {
    /**
     * Get session by ID
     * @throws SessionNotFoundError
     */
    getById(t: TransactionTask | undefined, sessionId: string): Promise<AuthSessions>;

    /**
     * List all active sessions for a user with pagination
     */
    listActiveByUser(
        t: TransactionTask,
        userId: string,
        pagination?: { page?: number; limit?: number }
    ): Promise<PaginatedResult<AuthSessions>>;

    /**
     * List all sessions for a user (active and logged out) with pagination
     */
    listAllByUser(
        t: TransactionTask,
        userId: string,
        pagination?: { page?: number; limit?: number }
    ): Promise<PaginatedResult<AuthSessions>>;

    /**
     * Create a new session
     * @throws ConcurrentSessionLimitError
     */
    create(
        t: TransactionTask,
        data: {
            user_id: string;
            ip_address?: string;
            user_agent?: string;
        }): Promise<AuthSessions>;

    /**
     * Update session (e.g., set logout_at)
     * @throws SessionNotFoundError
     */
    update(t: TransactionTask | undefined, sessionId: string, data: Partial<AuthSessions>): Promise<AuthSessions>;

    /**
     * Logout session (sets logout_at)
     * @throws SessionNotFoundError
     */
    logout(t: TransactionTask, sessionId: string): Promise<void>;

    /**
     * Revoke session (immediate invalidation)
     * @throws SessionNotFoundError
     */
    revoke(t: TransactionTask, sessionId: string, actingUserId: string): Promise<void>;

    revokeOneForUser(t: TransactionTask, sessionId: string, userId: string, actingUserId: string): Promise<void>;

    /**
     * Revoke all sessions for a user
     */
    revokeAllByUser(t: TransactionTask, userId: string, actingUserId: string): Promise<void>;

    /**
     * Cleanup expired sessions
     */
    cleanupExpired(t: TransactionTask): Promise<void>;

    /**
     * Validate session is active and not expired
     */
    isValid(t: TransactionTask | undefined, sessionId: string): Promise<boolean>;

    /**
     * Resolve session from session_token (Global Lookup)
     * Used by Authentication Middleware
     * @throws RBACInternalError (Session Not Found or Invalid)
     */
    resolveSession(t: TransactionTask | undefined, sessionToken: string): Promise<AuthSessions>;

    findAll(t: TransactionTask, filters?: { userId?: string; isActive?: boolean; search?: string }, pagination?: { page?: number; limit?: number }): Promise<PaginatedResult<AuthSessions>>;
}

/**
 * AuthSessionService Implementation
 */
export class AuthSessionService implements IAuthSessionService {
    constructor(
        private readonly authSessionsRepository: IAuthSessionsRepository,
        private readonly auditService: IAuditService,
        private readonly evaluationService: IEvaluationService,
    ) { }

    async getById(t: TransactionTask | undefined, sessionId: string): Promise<AuthSessions> {
        const session = await this.authSessionsRepository.findById(t, sessionId);
        if (!session) {
            throw new SessionNotFoundError(sessionId);
        }
        return session;
    }

    async findAll(t: TransactionTask, filters?: { userId?: string; isActive?: boolean; search?: string }, pagination?: { page?: number; limit?: number }): Promise<PaginatedResult<AuthSessions>> {
        return this.authSessionsRepository.findAll(t, filters, pagination);
    }

    async revokeOneForUser(t: TransactionTask, sessionId: string, userId: string, actingUserId: string): Promise<void> {
        const session = await this.getById(t, sessionId);
        if (!session) {
            throw new SessionNotFoundError(sessionId);
        }
        await this.authSessionsRepository.deleteOneForUser(t, sessionId, userId, actingUserId);
        await this.auditService.log(undefined, {
            user_id: actingUserId,
            action: 'delete',
            module_code: MODULE_CODE,
            entity_type: 'session',
            entity_id: session.id,
            old_values: {
                ip_address: session.ip_address,
                user_agent: session.user_agent,
                login_at: session.login_at
            },
            new_values: {
                logout_at: new Date().toISOString()
            },
            ip_address: session.ip_address,
            user_agent: session.user_agent,
            status: 'success'
        })

    }


    async listActiveByUser(t: TransactionTask, userId: string, pagination?: { page?: number; limit?: number }): Promise<PaginatedResult<AuthSessions>> {
        return this.authSessionsRepository.findActiveByUser(t, userId, pagination);
    }

    async listAllByUser(t: TransactionTask, userId: string, pagination?: { page?: number; limit?: number }): Promise<PaginatedResult<AuthSessions>> {
        return this.authSessionsRepository.findAllByUser(t, userId, pagination);
    }

    async create(t: TransactionTask, data: {
        user_id: string;
        ip_address?: string;
        user_agent?: string;
    }): Promise<AuthSessions> {
        // Check concurrent session limit
        const activeSessions = await this.authSessionsRepository.findActiveByUser(t, data.user_id);
        if (activeSessions.data.length >= MAX_CONCURRENT_SESSIONS_PER_USER) {
            throw new ConcurrentSessionLimitError(data.user_id);
        }

        const now = new Date();
        const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);

        const session = await this.authSessionsRepository.create(t, {
            user_id: data.user_id,
            session_token: crypto.randomUUID(),
            ip_address: data.ip_address || '',
            user_agent: data.user_agent || '',
            login_at: now,
            expires_at: expiresAt,
            logout_at: null
        });

        // AUDIT: Log session creation (login) (fire-and-forget)
        await this.auditService.log(undefined, {
            user_id: data.user_id,
            action: 'create',
            module_code: MODULE_CODE,
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
        })

        return session;
    }

    async update(t: TransactionTask | undefined, sessionId: string, data: Partial<AuthSessions>): Promise<AuthSessions> {
        // Verify session exists
        const existing = await this.getById(t, sessionId);
        const updated: AuthSessions = {
            id: existing.id,
            user_id: existing.user_id,
            session_token: existing.session_token,
            login_at: existing.login_at,
            expires_at: data.expires_at !== undefined ? data.expires_at : existing.expires_at,
            logout_at: (data.logout_at !== undefined ? data.logout_at : existing.logout_at) as Date | null,
            ip_address: data.ip_address !== undefined ? data.ip_address : existing.ip_address,
            user_agent: data.user_agent !== undefined ? data.user_agent : existing.user_agent,
        };
        return this.authSessionsRepository.update(t, sessionId, updated);
    }

    async logout(t: TransactionTask, sessionId: string): Promise<void> {
        // Verify session exists
        const existing = await this.getById(t, sessionId);
        const updated: AuthSessions = {
            id: existing.id,
            user_id: existing.user_id,
            session_token: existing.session_token,
            login_at: existing.login_at,
            expires_at: new Date(),
            logout_at: new Date(),
            ip_address: existing.ip_address,
            user_agent: existing.user_agent,
        };
        await this.authSessionsRepository.update(t, sessionId, updated);

        // AUDIT: Log session logout (fire-and-forget)
        await this.auditService.log(undefined, {
            user_id: existing.user_id,
            module_code: MODULE_CODE,
            action: 'update',
            entity_type: 'session',
            entity_id: sessionId,
            old_values: { logout_at: null },
            new_values: { logout_at: new Date().toISOString() },
            status: 'success'
        })
    }

    async revoke(t: TransactionTask, sessionId: string, actingUserId: string): Promise<void> {
        const session = await this.getById(t, sessionId);
        if (!session) {
            throw new SessionNotFoundError(sessionId);
        }
        await this.authSessionsRepository.delete(t, sessionId, actingUserId);

        // AUDIT: Log session revocation (fire-and-forget)
        await this.auditService.log(undefined, {
            user_id: actingUserId,
            module_code: MODULE_CODE,
            action: 'delete',
            entity_type: 'session',
            entity_id: sessionId,
            old_values: { ...session } as Record<string, unknown>,
            new_values: { revoked: true, revoked_by: actingUserId },
            status: 'success'
        })
    }

    async revokeAllByUser(t: TransactionTask, userId: string, actingUserId: string): Promise<void> {
        // Get session count for audit
        const sessions = await this.authSessionsRepository.findAllByUser(t, userId);
        const sessionCount = sessions.data.length;

        await this.authSessionsRepository.deleteAllByUser(t, userId);

        // AUDIT: Log bulk session revocation (fire-and-forget)
        await this.auditService.log(undefined, {
            user_id: actingUserId,
            module_code: MODULE_CODE,
            action: 'delete',
            entity_type: 'sessions_bulk',
            entity_id: userId,
            old_values: { session_count: sessionCount },
            new_values: { revoked_all: true, target_user_id: userId },
            status: 'success'
        })
    }

    async cleanupExpired(t: TransactionTask): Promise<void> {
        await this.authSessionsRepository.deleteExpired(t);
    }

    /**
     * Validate session is active and not expired
     */
    async isValid(t: TransactionTask | undefined, sessionId: string): Promise<boolean> {
        try {
            const session = await this.authSessionsRepository.findById(t, sessionId);
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
    async resolveSession(t: TransactionTask | undefined, sessionToken: string): Promise<AuthSessions> {
        const session = await this.authSessionsRepository.findBySessionToken(t, sessionToken);
        console.log('LOOKUP TOKEN:', sessionToken);

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
