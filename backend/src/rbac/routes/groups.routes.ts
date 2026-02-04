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
import { AuditService, IAuditService } from '../services/audit.service';
import { PermissionsRepository } from '../repositories/permissions.repository';
import { ModuleRepository } from '../repositories/modules.repository';
import { RoleProfilesRepository } from '../repositories/role_profiles.repository';
import { UserRoleRepository } from '../repositories/user_roles.repository';
import { ProfilePermissionsRepository } from '../repositories/profile_permissions.repository';
import { UsersRepository } from '../repositories/users.repository';
import { parseId, parsePagination } from './_paramUtils';
import { IDatabase } from 'pg-promise';
import { AuditLogsRepository } from '../repositories/audit_logs.repository';
import { UserGroupsRepository } from '../repositories/user_groups.repository';
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
function parseFilter(query: any): any {
    const filter: any = {};
    if (query.name) filter.name = query.name;
    if (query.is_active) filter.is_active = query.is_active;
    if (query.code) filter.code = query.code;
    return filter;
}

export function createGroupsRouter(db: IDatabase<unknown>): Router {
    const router = Router();

    // Initialize repositories
    const groupRepository = new GroupRepository(db);
    const groupRoleRepository = new GroupRoleRepository(db);
    const permissionsRepository = new PermissionsRepository(db);
    const moduleRepository = new ModuleRepository(db);
    const roleProfilesRepository = new RoleProfilesRepository(db);
    const userRoleRepository = new UserRoleRepository(db);
    const profilePermissionsRepository = new ProfilePermissionsRepository(db);
    const usersRepository = new UsersRepository(db);
    const auditRepository = new AuditLogsRepository(db);
    const userGroupsRepository = new UserGroupsRepository(db);
    // Initialize services
    const evaluationService = new EvaluationService(
        permissionsRepository,
    );
    const auditService = new AuditService(
        auditRepository,
        evaluationService,
        moduleRepository
    );
    const groupService = new UnifiedGroupService(
        groupRepository,
        groupRoleRepository,
        evaluationService,
        auditService,
        userGroupsRepository
    );

    /**
     * GET /rbac/groups
     * List all groups (paginated)
     */
    router.get('/', requirePermission('SETTINGS', 'read', evaluationService, auditService), async (req: Request, res: Response, next: NextFunction) => {
        try {
            const actingUserId = req.user!.id;
            const pagination = parsePagination(req.query);
            const filter = parseFilter(req.query);

            const result = await groupService.listAll(actingUserId, filter, pagination);
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
    router.get('/:id', requirePermission('SETTINGS', 'read', evaluationService, auditService), async (req: Request, res: Response, next: NextFunction) => {
        try {
            const groupId = parseId(req.params.id, 'groupId');
            const group = await groupService.getById(req.user!.id, groupId);
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
    router.post('/', requirePermission('SETTINGS', 'create', evaluationService, auditService), async (req: Request, res: Response, next: NextFunction) => {
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
    router.patch('/:id', requirePermission('SETTINGS', 'update', evaluationService, auditService), async (req: Request, res: Response, next: NextFunction) => {
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
    router.delete('/:id', requirePermission('SETTINGS', 'delete', evaluationService, auditService), async (req: Request, res: Response, next: NextFunction) => {
        try {
            const actingUserId = req.user!.id;
            const groupId = parseId(req.params.id, 'groupId');
            await groupService.delete(actingUserId, groupId);
            sendSuccess(res, { deleted: true });
        } catch (error) {
            next(error);
        }
    });

    return router;
}
