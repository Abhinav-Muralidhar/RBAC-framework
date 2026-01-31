/**
 * Groups Routes
 * 
 * REST API routes for group management.
 * All routes require authentication (applied at router level).
 */

import { Router, Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import { UnifiedGroupService } from '../services/group.service';
import { GroupRepository } from '../repositories/groups.repository';
import { GroupRoleRepository } from '../repositories/group_roles.repository';
import { EvaluationService } from '../services/evaluation.service';
import { IAuditService } from '../services/audit.service';
import { PermissionsRepository } from '../repositories/permissions.repository';
import { ModuleRepository } from '../repositories/modules.repository';
import { RoleProfilesRepository } from '../repositories/role_profiles.repository';
import { UserRoleRepository } from '../repositories/user_roles.repository';
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

export function createGroupsRouter(pool: Pool, auditService: IAuditService): Router {
    const router = Router();

    // Initialize repositories
    const groupRepository = new GroupRepository(pool);
    const groupRoleRepository = new GroupRoleRepository(pool);
    const permissionsRepository = new PermissionsRepository(pool);
    const moduleRepository = new ModuleRepository(pool);
    const roleProfilesRepository = new RoleProfilesRepository(pool);
    const userRoleRepository = new UserRoleRepository(pool);
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
    const groupService = new UnifiedGroupService(
        groupRepository,
        groupRoleRepository,
        evaluationService,
        auditService
    );

    /**
     * GET /rbac/groups
     * List all groups (paginated)
     */
    router.get('/', async (req: Request, res: Response, next: NextFunction) => {
        try {
            const actingUserId = req.user!.id;
            const pagination = parsePagination(req.query);

            const result = await groupService.listPaginated(actingUserId, {}, pagination);
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
     * GET /rbac/groups/:id
     * Get group by ID with full details (JOINed data)
     */
    router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
        try {
            const groupId = parseId(req.params.id, 'groupId');
            const group = await groupRepository.findByIdWithDetails(groupId);
            if (!group) {
                return sendError(res, 404, `Group not found: ${groupId}`, 'GROUP_NOT_FOUND');
            }
            sendSuccess(res, group);
        } catch (error) {
            next(error);
        }
    });

    /**
     * POST /rbac/groups
     * Create new group
     */
    router.post('/', async (req: Request, res: Response, next: NextFunction) => {
        try {
            const actingUserId = req.user!.id;
            const group = await groupService.create(actingUserId, req.body);
            sendSuccess(res, group);
        } catch (error) {
            next(error);
        }
    });

    /**
     * PATCH /rbac/groups/:id
     * Update group
     */
    router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
        try {
            const actingUserId = req.user!.id;
            const groupId = parseId(req.params.id, 'groupId');
            const group = await groupService.update(actingUserId, groupId, req.body);
            sendSuccess(res, group);
        } catch (error) {
            next(error);
        }
    });

    /**
     * DELETE /rbac/groups/:id
     * Delete group (soft delete)
     */
    router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
        try {
            const actingUserId = req.user!.id;
            const groupId = parseId(req.params.id, 'groupId');
            await groupService.delete(actingUserId, groupId);
            sendSuccess(res, { deleted: true });
        } catch (error) {
            next(error);
        }
    });

    /**
     * PUT /rbac/groups/:id/roles
     * Replace all group roles
     */
    router.put('/:id/roles', async (req: Request, res: Response, next: NextFunction) => {
        try {
            const actingUserId = req.user!.id;
            const groupId = parseId(req.params.id, 'groupId');
            const { role_ids } = req.body;
            await groupService.replaceRoles(actingUserId, groupId, role_ids ?? []);
            sendSuccess(res, { updated: true });
        } catch (error) {
            next(error);
        }
    });

    /**
     * POST /rbac/groups/:id/roles/:roleId
     * Assign role to group
     */
    router.post('/:id/roles/:roleId', async (req: Request, res: Response, next: NextFunction) => {
        try {
            const actingUserId = req.user!.id;
            const groupId = parseId(req.params.id, 'groupId');
            const roleId = parseId(req.params.roleId, 'roleId');
            await groupService.assignRole(actingUserId, groupId, roleId);
            sendSuccess(res, { assigned: true });
        } catch (error) {
            next(error);
        }
    });

    /**
     * DELETE /rbac/groups/:id/roles/:roleId
     * Remove role from group
     */
    router.delete('/:id/roles/:roleId', async (req: Request, res: Response, next: NextFunction) => {
        try {
            const actingUserId = req.user!.id;
            const groupId = parseId(req.params.id, 'groupId');
            const roleId = parseId(req.params.roleId, 'roleId');
            await groupService.removeRole(actingUserId, groupId, roleId);
            sendSuccess(res, { removed: true });
        } catch (error) {
            next(error);
        }
    });

    return router;
}
