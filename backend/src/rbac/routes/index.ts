/**
 * RBAC Routes Index
 *
 * Main router for all RBAC-related routes.
 * All routes are prefixed with /rbac and require authentication.
 */

import { Router } from 'express';
import { IDatabase } from 'pg-promise';
import { createAuthenticateMiddleware } from '../middleware/authenticate.middleware';
import { AuthSessionService } from '../services/authSession.service';
import { AuditService } from '../services/audit.service';
import { EvaluationService } from '../services/evaluation.service';
import { AuthSessionsRepository } from '../repositories/auth_sessions.repository';
import { AuditLogsRepository } from '../repositories/audit_logs.repository';
import { PermissionsRepository } from '../repositories/permissions.repository';
import { ModuleRepository } from '../repositories/modules.repository';
import { UsersRepository } from '../repositories/users.repository';
import { ProfilesRepository } from '../repositories/profiles.repository';
import { ProfilePermissionsRepository } from '../repositories/profile_permissions.repository';
import { RoleProfilesRepository } from '../repositories/role_profiles.repository';
import { RoleRepository } from '../repositories/roles.repository';
import { UserRoleRepository } from '../repositories/user_roles.repository';
import { createUsersRouter } from './users.routes';
import { createRolesRouter } from './roles.routes';
import { createProfilesRouter } from './profiles.routes';
import { createGroupsRouter } from './groups.routes';
import { createAuditLogsRouter } from './audit-logs.routes';
import { createSessionsRouter } from './sessions.routes';
import { createOrganizationsRouter } from './org.routes';
import { UserService } from '../services/user.service';
import { RoleService } from '../services/role.service';
import { ProfileService } from '../services/profile.service';
import { GroupRepository } from '../repositories/groups.repository';
import { UnifiedGroupService } from '../services/group.service';
import { GroupRoleRepository } from '../repositories/group_roles.repository';
import { UserGroupsRepository } from '../repositories/user_groups.repository';
import { OrganizationService } from '../services/organization.service';
import { OrganizationRepository } from '../repositories/organizations.repository';
import { createSmtpRouter } from './smtp.routes';
import { SmtpConfigRepository } from '../repositories/smtp_config.repository';
import { SmtpConfigService } from '../services/smtpConfig.service';

/**
 * Create the main RBAC router with all sub-routes
 */
export function createRBACRouter(db: IDatabase<unknown>): Router {
    const router = Router();

    // ============================
    // Repository initialization
    // ============================
    const authSessionsRepository = new AuthSessionsRepository(db);
    const auditLogsRepository = new AuditLogsRepository(db);
    const moduleRepository = new ModuleRepository(db);

    const sessionsRepo = new AuthSessionsRepository(db);
    const usersRepo = new UsersRepository(db);
    const auditLogsRepo = new AuditLogsRepository(db);
    const permissionsRepository = new PermissionsRepository(db);
    const profilesRepository = new ProfilesRepository(db);
    const profilePermissionsRepository = new ProfilePermissionsRepository(db);
    const roleProfilesRepository = new RoleProfilesRepository(db);
    const roleRepository = new RoleRepository(db);
    const userRolesRepository = new UserRoleRepository(db);
    const groupRepository = new GroupRepository(db);
    const groupRoleRepository = new GroupRoleRepository(db);
    const userGroupsRepository = new UserGroupsRepository(db);
    const organizationRepository = new OrganizationRepository(db);
    const smtpConfigRepository = new SmtpConfigRepository(db);
    // ============================
    // Services
    // ============================
    const evaluationService = new EvaluationService(new PermissionsRepository(db));

    const auditService = new AuditService(auditLogsRepository, evaluationService, moduleRepository);
    const groupService = new UnifiedGroupService(groupRepository, groupRoleRepository, auditService, userGroupsRepository);
    const authSessionService = new AuthSessionService(authSessionsRepository, auditService, evaluationService);
    const userService = new UserService(usersRepo, userRolesRepository, evaluationService, auditService);
    const roleService = new RoleService(roleRepository, userRolesRepository, roleProfilesRepository, evaluationService, auditService);
    const profileService = new ProfileService(profilesRepository, profilePermissionsRepository, permissionsRepository, evaluationService, auditService);
    const organizationService = new OrganizationService(organizationRepository, auditService);
    const smtpConfigService = new SmtpConfigService(smtpConfigRepository, auditService);
    // ============================
    // Middleware
    // ============================
    const authenticate = createAuthenticateMiddleware(authSessionService);

    // Apply authentication to ALL /rbac/* routes
    router.use(authenticate);

    // ============================
    // Routes
    // ============================
    router.use('/users', createUsersRouter(db, userService));
    router.use('/roles', createRolesRouter(db, auditService, evaluationService, roleService));
    router.use('/profiles', createProfilesRouter(db, auditService, evaluationService, profileService));
    router.use('/groups', createGroupsRouter(db, evaluationService, auditService, groupService));
    router.use('/audit-logs', createAuditLogsRouter(db, auditService, evaluationService));
    router.use('/sessions', createSessionsRouter(db, auditService, evaluationService, authSessionService));
    router.use('/organizations', createOrganizationsRouter(db, evaluationService, auditService, organizationService));
    router.use('/smtpconfig', createSmtpRouter(db, auditService, evaluationService, smtpConfigService))

    return router;
}
