/**
 * RBAC Routes Index
 * 
 * Main router for all RBAC-related routes.
 * All routes are prefixed with /rbac and require authentication.
 */

import { Router } from 'express';
import { Pool } from 'pg';
import { createAuthenticateMiddleware } from '../middleware/authenticate.middleware';
import { AuthSessionService } from '../services/authSession.service';
import { AuditService } from '../services/audit.service';
import { AuthSessionsRepository } from '../repositories/auth_sessions.repository';
import { AuditLogsRepository } from '../repositories/audit_logs.repository';
import { createUsersRouter } from './users.routes';
import { createRolesRouter } from './roles.routes';
import { createProfilesRouter } from './profiles.routes';
import { createGroupsRouter } from './groups.routes';
import { createAuditLogsRouter } from './audit-logs.routes';
import { createSessionsRouter } from './sessions.routes';

/**
 * Create the main RBAC router with all sub-routes
 */
export function createRBACRouter(pool: Pool): Router {
    const router = Router();

    // Initialize repositories
    const authSessionsRepository = new AuthSessionsRepository(pool);
    const auditLogsRepository = new AuditLogsRepository(pool);

    // Initialize services needed for middleware
    const auditService = new AuditService(auditLogsRepository);
    const authSessionService = new AuthSessionService(authSessionsRepository, auditService);

    // Create authentication middleware
    const authenticate = createAuthenticateMiddleware(authSessionService);

    // Apply authentication to ALL /rbac/* routes
    router.use(authenticate);

    // Mount sub-routers
    router.use('/users', createUsersRouter(pool, auditService));
    router.use('/roles', createRolesRouter(pool, auditService));
    router.use('/profiles', createProfilesRouter(pool, auditService));
    router.use('/groups', createGroupsRouter(pool, auditService));
    router.use('/audit-logs', createAuditLogsRouter(pool));
    router.use('/sessions', createSessionsRouter(pool, auditService));

    return router;
}
