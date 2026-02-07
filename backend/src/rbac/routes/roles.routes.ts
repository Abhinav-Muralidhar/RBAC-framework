/**
 * Roles Routes
 * 
 * REST API routes for role management.
 * All routes require authentication (applied at router level).
 */

import { Router, Request, Response, NextFunction } from 'express';
import { RoleService } from '../services/role.service';
import { EvaluationService } from '../services/evaluation.service';
import { IAuditService } from '../services/audit.service';
import { parseId, parsePagination } from './_paramUtils';
import { IDatabase } from 'pg-promise';
import { requirePermission } from '../middleware/requirePermission.middleware';
import { TransactionTask, withTransaction } from '../utils/transaction.utils';

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

export function createRolesRouter(db: IDatabase<unknown>, auditService: IAuditService, evaluationService: EvaluationService, roleService: RoleService): Router {
    const router = Router();

    /**
     * GET /rbac/roles
     * List all roles (paginated)
     */
    router.get('/', requirePermission('SETTINGS', 'read', evaluationService, auditService), async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await withTransaction(async (t: TransactionTask) => {

                const actingUserId = req.user!.id;
                const pagination = parsePagination(req.query);
                const filters = filter(req.query);

                const result = await roleService.listPaginated(t, actingUserId, filters, pagination);
                return result;
            });
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
            const result = await withTransaction(async (t: TransactionTask) => {

                const roleId = parseId(req.params.id, 'roleId');
                const role = await roleService.getById(t, req.user!.id, roleId);
                if (!role) {
                    const err = new Error('Role not found');
                    (err as any).status = 404;
                    throw err;
                }
                return role;
            });
            sendSuccess(res, result);
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
            const result = await withTransaction(async (t: TransactionTask) => {

                const actingUserId = req.user!.id;
                const role = await roleService.createRoleProfiles(t, actingUserId, req.body);
                return role;
            });
            sendSuccess(res, result);
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
            const result = await withTransaction(async (t: TransactionTask) => {

                const actingUserId = req.user!.id;
                const roleId = parseId(req.params.id, 'roleId');
                const role = await roleService.updateRoleProfiles(t, actingUserId, roleId, req.body);
                return role;
            });
            sendSuccess(res, result);
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
            const result = await withTransaction(async (t: TransactionTask) => {

                const actingUserId = req.user!.id;
                const roleId = parseId(req.params.id, 'roleId');
                await roleService.delete(t, actingUserId, roleId);
                return { message: 'Role deleted successfully' };
            });
            sendSuccess(res, result);
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
            const result = await withTransaction(async (t: TransactionTask) => {

                const actingUserId = req.user!.id;
                const roleId = parseId(req.params.id, 'roleId');
                const { profile_ids } = req.body;
                await roleService.updateRoleProfiles(t, actingUserId, roleId, profile_ids ?? []);
                return { message: 'Role profiles updated successfully' };
            });
            sendSuccess(res, result);
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
            await withTransaction(async (t: TransactionTask) => {

                const actingUserId = req.user!.id;
                const roleId = parseId(req.params.id, 'roleId');
                const targetUserId = parseId(req.params.userId, 'userId');
                await roleService.unassignRoleFromUser(t, actingUserId, roleId, targetUserId);
                sendSuccess(res, { revoked: true });
            });
        } catch (error) {
            next(error);
        }
    });

    return router;
}
