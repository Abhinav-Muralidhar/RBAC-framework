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

export function createRolesRouter(pool: Pool, auditService: IAuditService): Router {
    const router = Router();

    // Initialize repositories
    const roleRepository = new RoleRepository(pool);
    const roleProfilesRepository = new RoleProfilesRepository(pool);
    const userRoleRepository = new UserRoleRepository(pool);
    const permissionsRepository = new PermissionsRepository(pool);
    const moduleRepository = new ModuleRepository(pool);
    const profilePermissionsRepository = new ProfilePermissionsRepository(pool);
    const usersRepository = new UsersRepository(pool);

    // Initialize services
    const evaluationService = new EvaluationService(
        moduleRepository,
        userRoleRepository,
        roleProfilesRepository,
        profilePermissionsRepository,
        permissionsRepository,
        usersRepository
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
    router.get('/', async (req: Request, res: Response, next: NextFunction) => {
        try {
            const actingUserId = req.user!.id;
            const pagination = parsePagination(req.query);

            const result = await roleService.listPaginated(actingUserId, {}, pagination);
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
    router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
        try {
            const roleId = parseId(req.params.id, 'roleId');
            const role = await roleRepository.findByIdWithDetails(roleId);
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
    router.post('/', async (req: Request, res: Response, next: NextFunction) => {
        try {
            const actingUserId = req.user!.id;
            const role = await roleService.create(actingUserId, req.body);
            sendSuccess(res, role);
        } catch (error) {
            next(error);
        }
    });

    /**
     * PATCH /rbac/roles/:id
     * Update role
     */
    router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
        try {
            const actingUserId = req.user!.id;
            const roleId = parseId(req.params.id, 'roleId');
            const role = await roleService.update(actingUserId, roleId, req.body);
            sendSuccess(res, role);
        } catch (error) {
            next(error);
        }
    });

    /**
     * DELETE /rbac/roles/:id
     * Delete role (soft delete)
     */
    router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
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
    router.put('/:id/profiles', async (req: Request, res: Response, next: NextFunction) => {
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
     * POST /rbac/roles/:id/assign/:userId
     * Assign role to user
     */
    router.post('/:id/assign/:userId', async (req: Request, res: Response, next: NextFunction) => {
        try {
            const actingUserId = req.user!.id;
            const roleId = parseId(req.params.id, 'roleId');
            const targetUserId = parseId(req.params.userId, 'userId');
            await roleService.assignToUser(actingUserId, targetUserId, roleId);
            sendSuccess(res, { assigned: true });
        } catch (error) {
            next(error);
        }
    });

    /**
     * DELETE /rbac/roles/:id/revoke/:userId
     * Revoke role from user
     */
    router.delete('/:id/revoke/:userId', async (req: Request, res: Response, next: NextFunction) => {
        try {
            const actingUserId = req.user!.id;
            const roleId = parseId(req.params.id, 'roleId');
            const targetUserId = parseId(req.params.userId, 'userId');
            await roleService.revokeFromUser(actingUserId, targetUserId, roleId);
            sendSuccess(res, { revoked: true });
        } catch (error) {
            next(error);
        }
    });

    return router;
}
