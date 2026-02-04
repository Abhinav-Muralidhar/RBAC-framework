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
import { IDatabase } from 'pg-promise';
import { EvaluationService } from '../services/evaluation.service';
import { PermissionsRepository } from '../repositories/permissions.repository';
import { createOrganizationsRouter } from './org.routes';

/**
 * Create the main RBAC router with all sub-routes
 */
export function createRBACRouter(db: IDatabase<unknown>): Router {
    const router = Router();

    // Initialize repositories
    const authSessionsRepository = new AuthSessionsRepository(db);
    const auditLogsRepository = new AuditLogsRepository(db);
    const evaluationService = new EvaluationService(
        new PermissionsRepository(db)
    );

    // Initialize services needed for middleware
    const auditService = new AuditService(auditLogsRepository, evaluationService);
    const authSessionService = new AuthSessionService(authSessionsRepository, auditService, evaluationService);

    // Create authentication middleware
    const authenticate = createAuthenticateMiddleware(authSessionService);

    // Apply authentication to ALL /rbac/* routes
    router.use(authenticate);

    // Mount sub-routers
    router.use('/users', createUsersRouter(db, auditService));
    router.use('/roles', createRolesRouter(db, auditService));
    router.use('/profiles', createProfilesRouter(db, auditService));
    router.use('/groups', createGroupsRouter(db));
    router.use('/audit-logs', createAuditLogsRouter(db));
    router.use('/sessions', createSessionsRouter(db, auditService));
    router.use('organizations', createOrganizationsRouter(db));

    return router;
}
