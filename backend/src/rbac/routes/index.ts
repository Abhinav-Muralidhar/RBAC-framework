/**
 * RBAC Routes Index
 *
 * Main router for all RBAC-related routes.
 * All routes are prefixed with /v1/rbac and require authentication unless
 * mounted under the dedicated public auth router.
 */

import { Router } from 'express';
import { IDatabase } from 'pg-promise';
import { createAuthenticateMiddleware } from '../middleware/authenticate.middleware';
import { injectAuditContext } from '../middleware/injectAuditContext.middleware';
import { withTransaction, TransactionTask } from '../../utils/transaction.utils';
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
import { GroupRepository } from '../repositories/groups.repository';
import { GroupRoleRepository } from '../repositories/group_roles.repository';
import { UserGroupsRepository } from '../repositories/user_groups.repository';
import { OrganizationRepository } from '../repositories/organizations.repository';
import { FilesRepository } from '../repositories/files.repository';
import { SmtpConfigRepository } from '../repositories/smtp_config.repository';
import { SharingRulesRepository } from '../repositories/sharing_rules.repository';
import { OtpTokenRepository } from '../repositories/otp_token.repository';
import { EvaluationService } from '../services/evaluation.service';
import { AuditService } from '../services/audit.service';
import { AuthSessionService } from '../services/authSession.service';
import { UserService, VALID_LANDING_PAGES } from '../services/user.service';
import { RoleService } from '../services/role.service';
import { ProfileService } from '../services/profile.service';
import { UnifiedGroupService } from '../services/group.service';
import { OrganizationService } from '../services/organization.service';
import { SmtpConfigService } from '../services/smtpConfig.service';
import { PermissionService } from '../services/permission.service';
import { ModuleService } from '../services/module.service';
import { OtpService } from '../services/otp.service';
import { SharingRuleService } from '../services/sharingRule.service';
import { createUsersRouter } from './users.routes';
import { createRolesRouter } from './roles.routes';
import { createProfilesRouter } from './profiles.routes';
import { createGroupsRouter } from './groups.routes';
import { createAuditLogsRouter } from './audit-logs.routes';
import { createSessionsRouter } from './sessions.routes';
import { createOrganizationsRouter } from './org.routes';
import { createSmtpRouter } from './smtp.routes';
import { createPermissionsRouter } from './permissions.routes';
import { createEmailRouter } from './email.routes';
import { createOtpRouter } from './otp.routes';
import { createSharingRulesRouter } from './sharingrules.routes';

type RbacDependencies = ReturnType<typeof buildRbacDependencies>;
type PublicAuthDependencies = ReturnType<typeof buildPublicAuthDependencies>;

function buildRbacDependencies(db: IDatabase<unknown>) {
    const authSessionsRepository = new AuthSessionsRepository(db);
    const auditLogsRepository = new AuditLogsRepository(db);
    const permissionsRepository = new PermissionsRepository(db);
    const moduleRepository = new ModuleRepository(db);
    const usersRepository = new UsersRepository(db);
    const profilesRepository = new ProfilesRepository(db);
    const profilePermissionsRepository = new ProfilePermissionsRepository(db);
    const roleProfilesRepository = new RoleProfilesRepository(db);
    const roleRepository = new RoleRepository(db);
    const userRolesRepository = new UserRoleRepository(db);
    const groupRepository = new GroupRepository(db);
    const groupRoleRepository = new GroupRoleRepository(db);
    const userGroupsRepository = new UserGroupsRepository(db);
    const organizationRepository = new OrganizationRepository(db);
    const filesRepository = new FilesRepository(db);
    const smtpConfigRepository = new SmtpConfigRepository(db);
    const sharingRuleRepository = new SharingRulesRepository(db);

    const evaluationService = new EvaluationService(permissionsRepository);
    const auditService = new AuditService(
        auditLogsRepository,
        evaluationService,
        moduleRepository,
        usersRepository,
        roleRepository
    );
    const authSessionService = new AuthSessionService(authSessionsRepository, usersRepository, auditService, evaluationService);
    const userService = new UserService(usersRepository, userRolesRepository, evaluationService, auditService);
    const roleService = new RoleService(
        roleRepository,
        userRolesRepository,
        roleProfilesRepository,
        evaluationService,
        auditService,
        profilesRepository
    );
    const profileService = new ProfileService(
        profilesRepository,
        profilePermissionsRepository,
        permissionsRepository,
        evaluationService,
        auditService
    );
    const groupService = new UnifiedGroupService(groupRepository, groupRoleRepository, auditService, userGroupsRepository);
    const organizationService = new OrganizationService(organizationRepository, auditService);
    const smtpConfigService = new SmtpConfigService(smtpConfigRepository, auditService);
    const permissionService = new PermissionService(
        permissionsRepository,
        profilesRepository,
        profilePermissionsRepository,
        roleProfilesRepository,
        moduleRepository,
        roleRepository,
        evaluationService,
        auditService
    );
    const moduleService = new ModuleService(moduleRepository, evaluationService, auditService);
    const sharingRuleService = new SharingRuleService(sharingRuleRepository, evaluationService, auditService);

    return {
        evaluationService,
        auditService,
        usersRepository,
        authSessionService,
        userService,
        roleService,
        profileService,
        groupService,
        organizationService,
        smtpConfigService,
        permissionService,
        moduleService,
        sharingRuleService,
    };
}

function buildPublicAuthDependencies(db: IDatabase<unknown>) {
    const usersRepository = new UsersRepository(db);
    const userRolesRepository = new UserRoleRepository(db);
    const otpTokenRepository = new OtpTokenRepository(db);
    const smtpConfigRepository = new SmtpConfigRepository(db);
    const auditLogsRepository = new AuditLogsRepository(db);
    const moduleRepository = new ModuleRepository(db);
    const permissionsRepository = new PermissionsRepository(db);
    const roleRepository = new RoleRepository(db);
    const organizationRepository = new OrganizationRepository(db);
    const filesRepository = new FilesRepository(db);

    const evaluationService = new EvaluationService(permissionsRepository);
    const auditService = new AuditService(
        auditLogsRepository,
        evaluationService,
        moduleRepository,
        usersRepository,
        roleRepository
    );
    const userService = new UserService(usersRepository, userRolesRepository, evaluationService, auditService);
    const otpService = new OtpService(otpTokenRepository);
    const smtpConfigService = new SmtpConfigService(smtpConfigRepository, auditService);
    const organizationService = new OrganizationService(organizationRepository, auditService);

    return {
        evaluationService,
        auditService,
        usersRepository,
        userService,
        otpService,
        smtpConfigService,
        organizationService,
    };
}

function mountPrivateRoutes(router: Router, db: IDatabase<unknown>, deps: RbacDependencies): void {
    router.use('/users', createUsersRouter(db, deps.evaluationService, deps.auditService, deps.userService));
    router.use('/roles', createRolesRouter(db, deps.auditService, deps.evaluationService, deps.roleService));
    router.use('/profiles', createProfilesRouter(db, deps.auditService, deps.evaluationService, deps.profileService));
    router.use('/permissions', createPermissionsRouter(db, deps.permissionService, deps.moduleService, deps.evaluationService, deps.auditService));
    router.use('/groups', createGroupsRouter(db, deps.evaluationService, deps.auditService, deps.groupService));
    router.use('/audit-logs', createAuditLogsRouter(db, deps.auditService, deps.evaluationService));
    router.use('/sessions', createSessionsRouter(db, deps.auditService, deps.evaluationService, deps.authSessionService));
    router.use('/organizations', createOrganizationsRouter(db, deps.evaluationService, deps.auditService, deps.organizationService));
    router.use('/smtpconfig', createSmtpRouter(db, deps.auditService, deps.evaluationService, deps.smtpConfigService));
    router.use('/sharing-rules', createSharingRulesRouter(db, deps.auditService, deps.evaluationService, deps.sharingRuleService));
    router.use('/email', createEmailRouter(db, deps.authSessionService, deps.smtpConfigService, deps.usersRepository, deps.evaluationService, deps.auditService));
}

export function createRBACRouter(db: IDatabase<unknown>): Router {
    const router = Router();
    const deps = buildRbacDependencies(db);
    const authenticate = createAuthenticateMiddleware(deps.authSessionService);

    router.options(/.*/, (_req, res) => {
        res.sendStatus(204);
    });

    router.use(authenticate);
    router.use(injectAuditContext());
    mountPrivateRoutes(router, db, deps);

    router.get('/landing-pages', (_req, res) => {
        res.json({ data: VALID_LANDING_PAGES, error: null });
    });

    return router;
}

export function createPublicAuthRouter(db: IDatabase<unknown>): Router {
    const router = Router();
    const deps = buildPublicAuthDependencies(db);

    router.use(
        '/otp',
        createOtpRouter(
            db,
            deps.auditService,
            deps.evaluationService,
            deps.userService,
            deps.otpService,
            deps.smtpConfigService
        )
    );

    router.get('/organization/branding', async (req, res, next) => {
        try {
            const result = await withTransaction(db, async (t: TransactionTask) => {
                const orgs = await deps.organizationService.getOrganizations(t, { is_active: true }, { page: 1, limit: 1 });
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
