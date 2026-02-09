/**
 * Profiles Routes
 * 
 * REST API routes for profile management.
 * All routes require authentication (applied at router level).
 */

import { Router, Request, Response, NextFunction } from 'express';
import { ProfileService } from '../services/profile.service';
import { EvaluationService } from '../services/evaluation.service';
import { IAuditService } from '../services/audit.service';
import { parseId, parsePagination } from './_paramUtils';
import { IDatabase } from 'pg-promise';
import { requirePermission } from '../middleware/requirePermission.middleware';
import { withTransaction, TransactionTask } from '../utils/transaction.utils';
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
    if (query.is_active) filter.is_active = query.is_active;
    if (query.code) filter.code = query.code;
    if (query.search) filter.search = query.search;
    return filter;
}


export function createProfilesRouter(db: IDatabase<unknown>, auditService: IAuditService, evaluationService: EvaluationService, profileService: ProfileService): Router {
    const router = Router();

    /**
     * GET /rbac/profiles
     * List all profiles (paginated)
     */
    router.get('/', requirePermission('SETTINGS', 'read', evaluationService, auditService), async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await withTransaction(async (t: TransactionTask) => {

                const actingUserId = req.user!.id;
                const pagination = parsePagination(req.query);
                const filter = parseFilter(req.query);
                const result = await profileService.listPaginated(t, actingUserId, filter, pagination);
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
     * GET /rbac/profiles/:id
     * Get profile by ID with full details (JOINed data)
     */
    router.get('/:id', requirePermission('SETTINGS', 'read', evaluationService, auditService), async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await withTransaction(async (t: TransactionTask) => {

                const profileId = parseId(req.params.id, 'profileId');
                const profile = await profileService.getById(t, req.user!.id, profileId);
                if (!profile) {
                    const err = new Error('Profile not found');
                    (err as any).status = 404;
                    throw err;
                }
                return profile;
            });
            sendSuccess(res, result);
        } catch (error) {
            next(error);
        }
    });

    /**
     * POST /rbac/profiles
     * Create new profile
     */
    router.post('/', requirePermission('SETTINGS', 'create', evaluationService, auditService), async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await withTransaction(async (t: TransactionTask) => {

                const actingUserId = req.user!.id;
                const profile = await profileService.create(t, actingUserId, req.body);
                return profile;
            });
            sendSuccess(res, result);
        } catch (error) {
            next(error);
        }
    });

    /**
     * PATCH /rbac/profiles/:id
     * Update profile
     */
    router.patch('/:id', requirePermission('SETTINGS', 'update', evaluationService, auditService), async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await withTransaction(async (t: TransactionTask) => {

                const actingUserId = req.user!.id;
                const profileId = parseId(req.params.id, 'profileId');
                const profile = await profileService.update(t, actingUserId, profileId, req.body);
                return profile;
            });
            sendSuccess(res, result);
        } catch (error) {
            next(error);
        }
    });

    /**
     * DELETE /rbac/profiles/:id
     * Delete profile (soft delete)
     */
    router.delete('/:id', requirePermission('SETTINGS', 'delete', evaluationService, auditService), async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await withTransaction(async (t: TransactionTask) => {

                const actingUserId = req.user!.id;
                const profileId = parseId(req.params.id, 'profileId');
                await profileService.delete(t, actingUserId, profileId);
                return { message: 'Profile deleted successfully' };
            });
            sendSuccess(res, result);
        } catch (error) {
            next(error);
        }
    });

    return router;
}
