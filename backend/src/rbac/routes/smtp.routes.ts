/**
 * SMTP Config Routes
 * 
 * REST API routes for managing SMTP configurations.
 * All routes require authentication (applied at router level).
 */

import { Router, Request, Response, NextFunction } from 'express';
import { IDatabase } from 'pg-promise';
import { SmtpConfigRepository } from '../repositories/smtp_config.repository';
import { SmtpConfigService } from '../services/smtpConfig.service';
import { AuditService } from '../services/audit.service';
import { parsePagination, getRequiredParam } from './_paramUtils';
import { SmtpConfigCreate } from '../dto/smtp_config.dto';
import { PermissionsRepository } from '../repositories/permissions.repository';
import { EvaluationService } from '../services/evaluation.service';
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

/**
 * Parse filters from query parameters
 */
function parseFilters(query: any): { isActive?: boolean; search?: string } {
    const filters: { isActive?: boolean; search?: string } = {};
    if (query.is_active === 'true') filters.isActive = true;
    if (query.is_active === 'false') filters.isActive = false;
    if (query.search) filters.search = query.search;
    return filters;
}

export function createSmtpRouter(db: IDatabase<unknown>, auditService: AuditService, evaluationService: EvaluationService, smtpService: SmtpConfigService): Router {
    const router = Router();
    // --- List all SMTP configs ---
    router.get('/', requirePermission('SETTINGS', 'read', evaluationService, auditService), async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await withTransaction(async (t: TransactionTask) => {
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

    // --- Get SMTP config by ID ---
    router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await withTransaction(async (t: TransactionTask) => {
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
    router.post('/', requirePermission('SETTINGS', 'create', evaluationService, auditService), async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await withTransaction(async (t: TransactionTask) => {
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

    // --- Update an existing SMTP config ---
    router.patch('/:id', requirePermission('SETTINGS', 'update', evaluationService, auditService), async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await withTransaction(async (t: TransactionTask) => {
                const id = getRequiredParam(req.params, 'id');
                const data = req.body;
                const actingUserId = req.user!.id;
                const updated = await smtpService.update(t, id, data, actingUserId, req.auditContext);
                return updated;
            });
            sendSuccess(res, result);
        } catch (error) {
            next(error);
        }
    });

    // Delete an SMTP config
    router.delete('/:id', requirePermission('SETTINGS', 'delete', evaluationService, auditService), async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await withTransaction(async (t: TransactionTask) => {
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

    return router;
}
