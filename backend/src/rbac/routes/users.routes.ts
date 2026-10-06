/**
 * Users Routes
 * 
 * REST API routes for user management.
 * All routes require authentication (applied at router level).
 */

import { Router, Request, Response, NextFunction } from 'express';
import { UserService } from '../services/user.service';
import { getOptionalQuery, parseId, parsePagination, pickAllowedFields } from './_paramUtils';
import { IDatabase } from 'pg-promise';
import { TransactionTask, withTransaction } from '../../utils/transaction.utils';
import { requirePermission } from '../middleware/requirePermission.middleware';
import { EvaluationService } from '../services/evaluation.service';
import { AuditService } from '../services/audit.service';
import { CreateUserRequestDto, UpdateUserRequestDto } from '../dto/user.dto';
import { sendSuccess } from './_response';

function parseFilters(query: Request['query']): { name?: string; email?: string; username?: string; status?: string; search?: string } {
    const filters: { name?: string; email?: string; username?: string; status?: string; search?: string } = {};
    const name = getOptionalQuery(query, 'name');
    const email = getOptionalQuery(query, 'email');
    const username = getOptionalQuery(query, 'username');
    const status = getOptionalQuery(query, 'status');
    const search = getOptionalQuery(query, 'search');
    if (name) filters.name = name;
    if (email) filters.email = email;
    if (username) filters.username = username;
    if (status) filters.status = status;
    if (search) filters.search = search;
    return filters;
}

export function createUsersRouter(db: IDatabase<unknown>, evaluationService: EvaluationService, auditService: AuditService, userService: UserService): Router {
    const router = Router();
    const createUserFields = [
        'username', 'password', 'primary_email', 'last_name', 'first_name', 'title', 'department', 'reports_to_user_id',
        'secondary_email', 'other_email', 'office_phone', 'mobile_phone', 'home_phone', 'secondary_phone', 'fax',
        'street', 'city', 'state', 'country', 'postal_code', 'default_landing_page', 'name_format', 'phone_country_code',
        'full_screen_preview', 'preferred_currency', 'digit_grouping_pattern', 'decimal_separator', 'decimal_precision',
        'symbol_placement', 'trailing_zero_handling', 'time_zone', 'business_hours', 'aggregation_format', 'signature',
        'rolesid', 'rolesname'
    ] as const;
    const updateUserFields = [
        'version', 'username', 'password', 'status', 'first_name', 'last_name', 'title', 'department', 'reports_to_user_id',
        'primary_email', 'secondary_email', 'other_email', 'office_phone', 'mobile_phone', 'home_phone', 'secondary_phone',
        'fax', 'street', 'city', 'state', 'country', 'postal_code', 'default_landing_page', 'name_format',
        'phone_country_code', 'full_screen_preview', 'preferred_currency', 'digit_grouping_pattern', 'decimal_separator',
        'decimal_precision', 'symbol_placement', 'trailing_zero_handling', 'time_zone', 'business_hours',
        'aggregation_format', 'signature', 'last_login_at', 'password_changed_at', 'rolesid', 'rolesname'
    ] as const;
    const selfUpdateUserFields = [
        'version', 'password', 'first_name', 'last_name', 'title', 'department',
        'primary_email', 'secondary_email', 'other_email', 'office_phone', 'mobile_phone', 'home_phone',
        'secondary_phone', 'fax', 'street', 'city', 'state', 'country', 'postal_code', 'name_format',
        'phone_country_code', 'full_screen_preview', 'preferred_currency', 'digit_grouping_pattern',
        'decimal_separator', 'decimal_precision', 'symbol_placement', 'trailing_zero_handling',
        'time_zone', 'signature'
    ] as const;

    /**
     * GET /rbac/users
     * List all users (paginated)
     */
    router.get('/', requirePermission('SETTINGS', 'read', evaluationService, auditService), async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await withTransaction(db, async (t: TransactionTask) => {
                const actingUserId = req.user!.id;
                const pagination = parsePagination(req.query);
                const filters = parseFilters(req.query);

                const result = await userService.listPaginated(t, actingUserId, filters, pagination);
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
     * GET /rbac/users/:id
     * Get user by ID with full details (JOINed data)
     */
    router.get('/:id', requirePermission('SETTINGS', 'read', evaluationService, auditService), async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await withTransaction(db, async (t: TransactionTask) => {
                const userId = parseId(req.params.id, 'userId');

                const user = await userService.getById(t, req.user!.id, userId);
                if (!user) {
                    const err = new Error('User not found');
                    (err as any).status = 404;
                    throw err;
                }
                return user;
            });
            sendSuccess(res, result);
        } catch (error) {
            next(error);
        }
    });

    /**
     * POST /rbac/users
     * Create new user
     */
    router.post('/', requirePermission('SETTINGS', 'create', evaluationService, auditService), async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await withTransaction(db, async (t: TransactionTask) => {
                const actingUserId = req.user!.id;
                const payload = pickAllowedFields<CreateUserRequestDto, keyof CreateUserRequestDto>(req.body, createUserFields);
                const user = await userService.create(t, actingUserId, payload as CreateUserRequestDto, req.auditContext);
                return user;
            });
            sendSuccess(res, result);
        } catch (error) {
            next(error);
        }
    });

    /**
     * PATCH /rbac/users/:id
     * Update user
     */
    router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await withTransaction(db, async (t: TransactionTask) => {
                const actingUserId = req.user!.id;
                const userId = parseId(req.params.id, 'userId');
                if (actingUserId !== userId) {
                    await evaluationService.enforcePermission(actingUserId, 'SETTINGS', 'update', t);
                }
                const allowedFields = actingUserId === userId ? selfUpdateUserFields : updateUserFields;
                const payload = pickAllowedFields<UpdateUserRequestDto, keyof UpdateUserRequestDto>(req.body, allowedFields);
                const user = await userService.update(t, actingUserId, userId, payload as UpdateUserRequestDto, req.auditContext);
                return user;
            });
            sendSuccess(res, result);
        } catch (error) {
            next(error);
        }
    });

    /**
     * DELETE /rbac/users/:id
     * Delete user (soft delete)
     */
    router.delete('/:id', requirePermission('SETTINGS', 'delete', evaluationService, auditService), async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await withTransaction(db, async (t: TransactionTask) => {
                const actingUserId = req.user!.id;
                const userId = parseId(req.params.id, 'userId');
                await userService.delete(t, actingUserId, userId, req.auditContext);
                return { message: 'Deleted successfully' };
            });
            sendSuccess(res, result);
        } catch (error) {
            next(error);
        }
    });
    return router;
}
