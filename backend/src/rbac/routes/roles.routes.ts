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
import { getOptionalQuery, parseBooleanQuery, parseId, parsePagination, pickAllowedFields } from './_paramUtils';
import { IDatabase } from 'pg-promise';
import { requirePermission } from '../middleware/requirePermission.middleware';
import { TransactionTask, withTransaction } from '../../utils/transaction.utils';
import { CreateRoleRequestDto, UpdateRoleRequestDto } from '../dto/role.dto';
import { sendSuccess } from './_response';

function filter(query: Request['query']): { parent_role_id?: string; is_active?: boolean; search?: string } {
    const filters: { parent_role_id?: string; is_active?: boolean; search?: string } = {};
    const parentRoleId = getOptionalQuery(query, 'parent_role_id');
    const isActive = parseBooleanQuery(query, 'is_active');
    const search = getOptionalQuery(query, 'search');
    if (parentRoleId) filters.parent_role_id = parentRoleId;
    if (isActive !== undefined) filters.is_active = isActive;
    if (search) filters.search = search;
    return filters;
}

export function createRolesRouter(db: IDatabase<unknown>, auditService: IAuditService, evaluationService: EvaluationService, roleService: RoleService): Router {
    const router = Router();
    const createRoleFields = ['name', 'code', 'description', 'parent_role_id', 'is_active', 'profile_ids'] as const;
    const updateRoleFields = ['version', 'name', 'code', 'description', 'parent_role_id', 'is_active', 'profile_ids'] as const;

    /**
     * GET /rbac/roles
     * List all roles (paginated)
     */
    router.get('/', requirePermission('SETTINGS', 'read', evaluationService, auditService), async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await withTransaction(db, async (t: TransactionTask) => {

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


    router.get('/tree', requirePermission('SETTINGS', 'read', evaluationService, auditService), async (req, res, next) => {
        try {
            const tree = await withTransaction(db, async (t: TransactionTask) => {
                return roleService.getRoleTree(t, req.user!.id);
            });
            sendSuccess(res, tree);
        } catch (err) {
            next(err);
        }
    });

    /**
     * GET /rbac/roles/:id
     * Get role by ID with full details (JOINed data)
     */
    router.get('/:id', requirePermission('SETTINGS', 'read', evaluationService, auditService), async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await withTransaction(db, async (t: TransactionTask) => {

                const roleId = parseId(req.params.id, 'roleId');
                return roleService.getById(t, req.user!.id, roleId);
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
            const result = await withTransaction(db, async (t: TransactionTask) => {

                const actingUserId = req.user!.id;
                const payload = pickAllowedFields<CreateRoleRequestDto, keyof CreateRoleRequestDto>(req.body, createRoleFields);
                const role = await roleService.createRoleProfiles(t, actingUserId, payload as CreateRoleRequestDto, req.auditContext);
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
            const result = await withTransaction(db, async (t: TransactionTask) => {

                const actingUserId = req.user!.id;
                const roleId = parseId(req.params.id, 'roleId');
                const payload = pickAllowedFields<UpdateRoleRequestDto, keyof UpdateRoleRequestDto>(req.body, updateRoleFields);
                const role = await roleService.updateRoleProfiles(t, actingUserId, roleId, payload as UpdateRoleRequestDto, req.auditContext);
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
    router.delete('/:id', requirePermission('SETTINGS', 'delete', evaluationService, auditService), async (req, res, next) => {
        try {
            await withTransaction(db, async (t: TransactionTask) => {
                const roleId = parseId(req.params.id, 'roleId');
                await roleService.delete(t, req.user!.id, roleId, req.auditContext);
            });
            sendSuccess(res, { message: 'Role deleted successfully' });
        } catch (err: any) {
            next(err);
        }
    });
    /**
     * PUT /rbac/roles/:id/profiles
     * Update role profiles
     */
    router.put('/:id/profiles', requirePermission('SETTINGS', 'update', evaluationService, auditService), async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await withTransaction(db, async (t: TransactionTask) => {

                const actingUserId = req.user!.id;
                const roleId = parseId(req.params.id, 'roleId');
                const payload = pickAllowedFields<UpdateRoleRequestDto, keyof UpdateRoleRequestDto>(req.body, ['version', 'profile_ids']);
                await roleService.updateRoleProfiles(t, actingUserId, roleId, payload as UpdateRoleRequestDto, req.auditContext);
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
            await withTransaction(db, async (t: TransactionTask) => {

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
