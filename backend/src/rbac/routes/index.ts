/**
 * RBAC Routes Index
 *
 * Main router for all RBAC-related routes.
 * All routes are prefixed with /rbac and require authentication.
 */

import { Router } from 'express';
import { IDatabase } from 'pg-promise';
import { createAuthenticateMiddleware } from '../middleware/authenticate.middleware';
import { injectAuditContext } from '../middleware/injectAuditContext.middleware';
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
import { createPermissionsRouter } from './permissions.routes';
import { PermissionService } from '../services/permission.service';
import { ModuleService } from '../services/module.service';
import { createEmailRouter } from './email.routes';



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
    const usersRepo = new UsersRepository(db);
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
    const sharingRuleRepository = new SharingRulesRepository(db);
    // Services
    // ============================
    const evaluationService = new EvaluationService(new PermissionsRepository(db));

    const auditService = new AuditService(auditLogsRepository, evaluationService, moduleRepository, usersRepo, roleRepository);
    const groupService = new UnifiedGroupService(groupRepository, groupRoleRepository, auditService, userGroupsRepository);
    const authSessionService = new AuthSessionService(authSessionsRepository, auditService, evaluationService);
    const userService = new UserService(usersRepo, userRolesRepository, evaluationService, auditService);
    const roleService = new RoleService(roleRepository, userRolesRepository, roleProfilesRepository, evaluationService, auditService, profilesRepository);
    const profileService = new ProfileService(profilesRepository, profilePermissionsRepository, permissionsRepository, evaluationService, auditService);
    const organizationService = new OrganizationService(organizationRepository, auditService);
    const smtpConfigService = new SmtpConfigService(smtpConfigRepository, auditService);
    const permissionService = new PermissionService(permissionsRepository, profilesRepository, profilePermissionsRepository, roleProfilesRepository, moduleRepository, roleRepository, evaluationService, auditService
    );
    const sharingRuleService = new SharingRuleService(sharingRuleRepository, evaluationService, auditService);

    const moduleService = new ModuleService(moduleRepository, evaluationService, auditService);
    // ============================
    // Middleware
    // ============================
    const authenticate = createAuthenticateMiddleware(authSessionService);

    // Apply authentication to ALL /rbac/* routes
    router.use(authenticate);

    // Inject audit context (IP, user-agent, request ID, etc.) for audit logging
    router.use(injectAuditContext());

    // ============================
    // Routes
    // ============================
    router.use('/users', createUsersRouter(db, evaluationService, auditService, userService));
    router.use('/roles', createRolesRouter(db, auditService, evaluationService, roleService));
    router.use('/profiles', createProfilesRouter(db, auditService, evaluationService, profileService));
    router.use('/permissions', createPermissionsRouter(permissionService, moduleService));
    router.use('/groups', createGroupsRouter(db, evaluationService, auditService, groupService));
    router.use('/audit-logs', createAuditLogsRouter(db, auditService, evaluationService));
    router.use('/sessions', createSessionsRouter(db, auditService, evaluationService, authSessionService));
    router.use('/organizations', createOrganizationsRouter(db, evaluationService, auditService, organizationService));
    router.use('/smtpconfig', createSmtpRouter(db, auditService, evaluationService, smtpConfigService));
    router.use('/sharing-rules', createSharingRulesRouter(db, auditService, evaluationService, sharingRuleService));
    router.use('/email', createEmailRouter(authSessionService, smtpConfigService));
    return router;
}


// ============================
// PUBLIC ROUTES (NO AUTH)
// ============================

import { createOtpRouter } from './otp.routes';
import { OtpService } from '../services/otp.service';
import { OtpTokenRepository } from '../repositories/otp_token.repository';
import { createSharingRulesRouter } from './sharingrules.routes';
import { SharingRuleService } from '../services/sharingRule.service';
import { SharingRulesRepository } from '../repositories/sharing_rules.repository';
import { withTransaction } from '../utils/transaction.utils';
import type { TransactionTask } from '../utils/transaction.utils';

export function createPublicAuthRouter(db: IDatabase<unknown>): Router {
    const router = Router();

    // repositories
    const usersRepo = new UsersRepository(db);
    const userRolesRepository = new UserRoleRepository(db);
    const otpTokenRepository = new OtpTokenRepository(db);
    const smtpConfigRepository = new SmtpConfigRepository(db);
    const auditLogsRepository = new AuditLogsRepository(db);
    const moduleRepository = new ModuleRepository(db);

    // services
    const evaluationService = new EvaluationService(new PermissionsRepository(db));
    const roleRepository = new RoleRepository(db);
    const auditService = new AuditService(auditLogsRepository, evaluationService, moduleRepository, usersRepo, roleRepository);

    const userService = new UserService(
        usersRepo,
        userRolesRepository,
        evaluationService,
        auditService
    );

    const otpService = new OtpService(otpTokenRepository);
    const smtpConfigService = new SmtpConfigService(smtpConfigRepository, auditService);
    const organizationRepository = new OrganizationRepository(db);
    const organizationService = new OrganizationService(organizationRepository, auditService);

    // mount otp
    router.use(
        '/otp',
        createOtpRouter(
            db,
            auditService,
            evaluationService,
            userService,
            otpService,
            smtpConfigService
        )
    );

    /**
     * GET /public/organization/branding
     * Public endpoint — no auth required.
     * Returns non-sensitive organization details for UI rendering.
     */
    router.get('/organization/branding', async (req, res, next) => {
        try {
            const result = await withTransaction(async (t: TransactionTask) => {
                const orgs = await organizationService.getOrganizations(t, { is_active: true }, { page: 1, limit: 1 });
                if (!orgs.data.length) return null;
                const org = orgs.data[0]!;
                return {
                    company_name: org.company_name,
                    company_logo: org.company_logo || null,
                    address: org.address,
                    city: org.city,
                    state: org.state,
                    postal_code: org.postal_code,
                    country: org.country,
                    country_code: org.country_code,
                    phone: org.phone || null,
                    fax: org.fax || null,
                    website: org.website || null,
                    facebook: org.facebook || null,
                    twitter: org.twitter || null,
                    linkedin: org.linkedin || null,
                    gstin: org.gstin,
                };
            });
            res.json({ data: result, error: null, meta: {} });
        } catch (error) {
            next(error);
        }
    });

    return router;
}