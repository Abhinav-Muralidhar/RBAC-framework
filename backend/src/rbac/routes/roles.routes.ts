/**
 * Roles Routes
 * 
 * REST API routes for role management.
 * All routes require authentication (applied at router level).
 */

import { Router, Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import { RoleService } from '../services/role.service';
import { RoleRepository } from '../repositories/roles.repository';
import { RoleProfilesRepository } from '../repositories/role_profiles.repository';
import { UserRoleRepository } from '../repositories/user_roles.repository';
import { EvaluationService } from '../services/evaluation.service';
import { IAuditService } from '../services/audit.service';
import { PermissionsRepository } from '../repositories/permissions.repository';
import { ModuleRepository } from '../repositories/modules.repository';
import { ProfilePermissionsRepository } from '../repositories/profile_permissions.repository';
import { UsersRepository } from '../repositories/users.repository';
import { parseId, parsePagination } from './_paramUtils';
import { IDatabase } from 'pg-promise';
import { requirePermission } from '../middleware/requirePermission.middleware';

/**
 * Standard response envelope
 */
function sendSuccess<T>(res: Response, data: T, meta?: Record<string, unknown>) {
    res.json({ data, error: null, meta: meta ?? {} });
}

function sendError(res: Response, status: number, message: string, code?: string) {
    res.status(status).json({
        data: null,
        error: { message, code: code ?? 'ERROR' },
        meta: {}
    });
}
function filter(query: any): any {
    const filters: any = {};
    if (query.parent_role_id) filters.parent_role_id = query.parent_role_id;
    if (query.is_active) filters.is_active = query.is_active;
    if (query.search) filters.search = query.search;
    return filters;
}

export function createRolesRouter(db: IDatabase<unknown>, auditService: IAuditService): Router {
    const router = Router();

    // Initialize repositories
    const roleRepository = new RoleRepository(db);
    const roleProfilesRepository = new RoleProfilesRepository(db);
    const userRoleRepository = new UserRoleRepository(db);
    const permissionsRepository = new PermissionsRepository(db);
    const moduleRepository = new ModuleRepository(db);
    const profilePermissionsRepository = new ProfilePermissionsRepository(db);
    const usersRepository = new UsersRepository(db);

    // Initialize services
    const evaluationService = new EvaluationService(
        permissionsRepository
    );
    const roleService = new RoleService(
        roleRepository,
        userRoleRepository,
        roleProfilesRepository,
        evaluationService,
        auditService
    );

    /**
     * GET /rbac/roles
     * List all roles (paginated)
     */
    router.get('/', requirePermission('SETTINGS', 'read', evaluationService, auditService), async (req: Request, res: Response, next: NextFunction) => {
        try {
            const actingUserId = req.user!.id;
            const pagination = parsePagination(req.query);
            const filters = filter(req.query);

            const result = await roleService.listPaginated(actingUserId, filters, pagination);
            sendSuccess(res, result.data, {
                page: result.pagination.page,
                limit: result.pagination.limit,
                total: result.pagination.total,
                totalPages: result.pagination.totalPages
            });
        } catch (error) {
            next(error);
        }
    });

    /**
     * GET /rbac/roles/:id
     * Get role by ID with full details (JOINed data)
     */
    router.get('/:id', requirePermission('SETTINGS', 'read', evaluationService, auditService), async (req: Request, res: Response, next: NextFunction) => {
        try {
            const roleId = parseId(req.params.id, 'roleId');
            const role = await roleService.getById(req.user!.id, roleId);
            if (!role) {
                return sendError(res, 404, `Role not found: ${roleId}`, 'ROLE_NOT_FOUND');
            }
            sendSuccess(res, role);
        } catch (error) {
            next(error);
        }
    });

    /**
     * POST /rbac/roles
     * Create new role
     */
    router.post('/', requirePermission('SETTINGS', 'create', evaluationService, auditService), async (req: Request, res: Response, next: NextFunction) => {
        try {
            const actingUserId = req.user!.id;
            const role = await roleService.createRoleProfiles(actingUserId, req.body);
            sendSuccess(res, role);
        } catch (error) {
            next(error);
        }
    });

    /**
     * PATCH /rbac/roles/:id
     * Update role
     */
    router.patch('/:id', requirePermission('SETTINGS', 'update', evaluationService, auditService), async (req: Request, res: Response, next: NextFunction) => {
        try {
            const actingUserId = req.user!.id;
            const roleId = parseId(req.params.id, 'roleId');
            const role = await roleService.updateRoleProfiles(actingUserId, roleId, req.body);
            sendSuccess(res, role);
        } catch (error) {
            next(error);
        }
    });

    /**
     * DELETE /rbac/roles/:id
     * Delete role (soft delete)
     */
    router.delete('/:id', requirePermission('SETTINGS', 'delete', evaluationService, auditService), async (req: Request, res: Response, next: NextFunction) => {
        try {
            const actingUserId = req.user!.id;
            const roleId = parseId(req.params.id, 'roleId');
            await roleService.delete(actingUserId, roleId);
            sendSuccess(res, { deleted: true });
        } catch (error) {
            next(error);
        }
    });

    /**
     * PUT /rbac/roles/:id/profiles
     * Update role profiles
     */
    router.put('/:id/profiles', requirePermission('SETTINGS', 'update', evaluationService, auditService), async (req: Request, res: Response, next: NextFunction) => {
        try {
            const actingUserId = req.user!.id;
            const roleId = parseId(req.params.id, 'roleId');
            const { profile_ids } = req.body;
            await roleService.updateRoleProfiles(actingUserId, roleId, profile_ids ?? []);
            sendSuccess(res, { updated: true });
        } catch (error) {
            next(error);
        }
    });

    /**
     * DELETE /rbac/roles/:id/revoke/:userId
     * Revoke role from user
     */
    router.delete('/:id/revoke/:userId', requirePermission('SETTINGS', 'delete', evaluationService, auditService), async (req: Request, res: Response, next: NextFunction) => {
        try {
            const actingUserId = req.user!.id;
            const roleId = parseId(req.params.id, 'roleId');
            const targetUserId = parseId(req.params.userId, 'userId');
            await roleService.unassignRoleFromUser(actingUserId, roleId, targetUserId);
            sendSuccess(res, { revoked: true });
        } catch (error) {
            next(error);
        }
    });

    return router;
}
