/**
 * Groups Routes
 * 
 * REST API routes for group management.
 * All routes require authentication (applied at router level).
 */

import { Router, Request, Response, NextFunction } from 'express';
import { UnifiedGroupService } from '../services/group.service';
import { EvaluationService } from '../services/evaluation.service';
import { AuditService, IAuditService } from '../services/audit.service';
import { getOptionalQuery, parseBooleanQuery, parseId, parsePagination, pickAllowedFields } from './_paramUtils';
import { IDatabase } from 'pg-promise';
import { requirePermission } from '../middleware/requirePermission.middleware';
import { TransactionTask, withTransaction } from '../../utils/transaction.utils';
import { CreateGroupRequestDto, UpdateGroupRequestDto } from '../dto/group.dto';
import { sendSuccess } from './_response';
function parseFilter(query: Request['query']): { name?: string; isActive?: boolean; code?: string; search?: string } {
    const filter: { name?: string; isActive?: boolean; code?: string; search?: string } = {};
    const name = getOptionalQuery(query, 'name');
    const isActive = parseBooleanQuery(query, 'isActive');
    const code = getOptionalQuery(query, 'code');
    const search = getOptionalQuery(query, 'search');
    if (name) filter.name = name;
    if (isActive !== undefined) filter.isActive = isActive;
    if (code) filter.code = code;
    if (search) filter.search = search;
    return filter;
}

export function createGroupsRouter(db: IDatabase<unknown>, evaluationService: EvaluationService, auditService: AuditService, groupService: UnifiedGroupService): Router {
    const router = Router();
    const createGroupFields = ['name', 'code', 'description', 'is_active', 'role_ids', 'user_ids'] as const;
    const updateGroupFields = ['version', 'name', 'code', 'description', 'is_active', 'role_ids', 'user_ids'] as const;

    /**
     * GET /rbac/groups
     * List all groups (paginated)
     */
    router.get('/', requirePermission('SETTINGS', 'read', evaluationService, auditService), async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await withTransaction(db, async (t: TransactionTask) => {
                const actingUserId = req.user!.id;
                const pagination = parsePagination(req.query);
                const filter = parseFilter(req.query);

                const result = await groupService.listAll(t, actingUserId, filter, pagination);
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
     * GET /rbac/groups/:id
     * Get group by ID with full details (JOINed data)
     */
    router.get('/:id', requirePermission('SETTINGS', 'read', evaluationService, auditService), async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await withTransaction(db, async (t: TransactionTask) => {
                const groupId = parseId(req.params.id, 'groupId');
                return groupService.getById(t, req.user!.id, groupId);
            });
            sendSuccess(res, result);
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
            const result = await withTransaction(db, async (t: TransactionTask) => {
                const actingUserId = req.user!.id;
                const payload = pickAllowedFields<CreateGroupRequestDto, keyof CreateGroupRequestDto>(req.body, createGroupFields);
                const group = await groupService.create(t, actingUserId, payload as CreateGroupRequestDto, req.auditContext);
                return group;
            });
            sendSuccess(res, result);
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
            const result = await withTransaction(db, async (t: TransactionTask) => {
                const actingUserId = req.user!.id;
                const groupId = parseId(req.params.id, 'groupId');
                const payload = pickAllowedFields<UpdateGroupRequestDto, keyof UpdateGroupRequestDto>(req.body, updateGroupFields);
                const group = await groupService.update(t, actingUserId, groupId, payload as UpdateGroupRequestDto, req.auditContext);
                return group;
            });
            sendSuccess(res, result);
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
            const result = await withTransaction(db, async (t: TransactionTask) => {
                const actingUserId = req.user!.id;
                const groupId = parseId(req.params.id, 'groupId');
                await groupService.delete(t, actingUserId, groupId, req.auditContext);
                return { message: 'Group deleted successfully' };
            });
            sendSuccess(res, result);
        } catch (error) {
            next(error);
        }
    });
    return router;
}
