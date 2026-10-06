/**
 * SMTP Config Routes
 * 
 * REST API routes for managing SMTP configurations.
 * All routes require authentication (applied at router level).
 */

import { Router, Request, Response, NextFunction } from 'express';
import { IDatabase } from 'pg-promise';
import { SmtpConfigService } from '../services/smtpConfig.service';
import { AuditService } from '../services/audit.service';
import { getOptionalQuery, parseBooleanQuery, parsePagination, getRequiredParam, pickAllowedFields } from './_paramUtils';
import { SmtpConfigUpdate } from '../dto/smtp_config.dto';
import { EvaluationService } from '../services/evaluation.service';
import { requirePermission } from '../middleware/requirePermission.middleware';
import { TransactionTask, withTransaction } from '../../utils/transaction.utils';
import { sendSuccess } from './_response';

/**
 * Parse filters from query parameters
 */
function parseFilters(query: Request['query']): { isActive?: boolean; search?: string } {
    const filters: { isActive?: boolean; search?: string } = {};
    const isActive = parseBooleanQuery(query, 'is_active');
    const search = getOptionalQuery(query, 'search');
    if (isActive !== undefined) filters.isActive = isActive;
    if (search) filters.search = search;
    return filters;
}

export function createSmtpRouter(db: IDatabase<unknown>, auditService: AuditService, evaluationService: EvaluationService, smtpService: SmtpConfigService): Router {
    const router = Router();
    const updateSmtpFields = ['version', 'name', 'host', 'port', 'username', 'password', 'encryption', 'from_email', 'from_name', 'reply_to_email', 'is_active'] as const;
    // --- List all SMTP configs ---
    router.get('/', requirePermission('SETTINGS', 'read', evaluationService, auditService), async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await withTransaction(db, async (t: TransactionTask) => {
                const filters = parseFilters(req.query);
                const pagination = parsePagination(req.query);
                const result = await smtpService.listAll(t, filters, pagination);
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
     * GET /rbac/smtpconfig/active
     * Fetches the currently active SMTP configuration.
     */
    router.get('/active', requirePermission('SETTINGS', 'read', evaluationService, auditService), async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await withTransaction(db, async (t: TransactionTask) => {
                const config = await smtpService.getActiveReadModel(t);
                return config;
            });
            sendSuccess(res, result);
        } catch (error) {
            next(error);
        }
    });

    // --- Get SMTP config by ID ---
    router.get('/:id', requirePermission('SETTINGS', 'read', evaluationService, auditService), async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await withTransaction(db, async (t: TransactionTask) => {
                const id = getRequiredParam(req.params, 'id');
                const config = await smtpService.getById(t, id);
                return config;
            });
            sendSuccess(res, result);
        } catch (error) {
            next(error);
        }
    });

    // --- Create a new SMTP config ---
    /*
    router.post('/', requirePermission('SETTINGS', 'create', evaluationService, auditService), async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await withTransaction(db, async (t: TransactionTask) => {
                const data = req.body as SmtpConfigCreate;
                const actingUserId = req.user!.id;
                const config = await smtpService.create(t, data, actingUserId, req.auditContext);
                return config;
            });
            sendSuccess(res, result);
        } catch (error) {
            next(error);
        }
    });
    */

    // --- Update an existing SMTP config ---
    router.patch('/:id', requirePermission('SETTINGS', 'update', evaluationService, auditService), async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await withTransaction(db, async (t: TransactionTask) => {
                const id = getRequiredParam(req.params, 'id');
                const data = pickAllowedFields<SmtpConfigUpdate, keyof SmtpConfigUpdate>(req.body, updateSmtpFields);
                const actingUserId = req.user!.id;
                const updated = await smtpService.update(t, id, data as SmtpConfigUpdate, actingUserId, req.auditContext);
                return updated;
            });
            sendSuccess(res, result);
        } catch (error) {
            next(error);
        }
    });

    // Delete an SMTP config
    /*
    router.delete('/:id', requirePermission('SETTINGS', 'delete', evaluationService, auditService), async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await withTransaction(db, async (t: TransactionTask) => {
                const id = getRequiredParam(req.params, 'id');
                const actingUserId = req.user!.id;
                await smtpService.delete(t, id, actingUserId, req.auditContext);
                return { message: 'Deleted successfully' };
            });
            sendSuccess(res, result);
        } catch (error) {
            next(error);
        }
    });
    */

    return router;
}
