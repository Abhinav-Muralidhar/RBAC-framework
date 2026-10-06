/**
 * Audit Logs Routes
 * 
 * REST API routes for audit log viewing.
 * All routes require authentication (applied at router level).
 * 
 * Note: Audit logs are read-only via API. They are created internally by services.
 * Filtering is supported through encrypted HMAC-backed search inputs.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { getOptionalQuery, parseId, parsePagination } from './_paramUtils';
import { AuditService } from '../services/audit.service';
import { IDatabase } from 'pg-promise';
import { EvaluationService } from '../services/evaluation.service';
import { requirePermission } from '../middleware/requirePermission.middleware';
import { withTransaction, TransactionTask } from '../../utils/transaction.utils';
import { createPdfFromLines } from '../../utils/pdf.utils';
import { OrganizationRepository } from '../repositories/organizations.repository';
import { sendSuccess } from './_response';

function getDeviceInfoLines(req: Request): string[] {
    const headersToCapture = [
        'host',
        'origin',
        'referer',
        'accept',
        'accept-language',
        'x-forwarded-for',
        'x-real-ip',
        'sec-ch-ua',
        'sec-ch-ua-mobile',
        'sec-ch-ua-platform',
        'sec-fetch-site',
        'sec-fetch-mode',
        'sec-fetch-dest',
    ];

    const lines = [
        `Exported At: ${new Date().toISOString()}`,
        `Exported By User ID: ${req.user?.id ?? 'unknown'}`,
        `Request ID: ${req.auditContext?.request_id ?? 'unknown'}`,
        `Session ID: ${req.auditContext?.session_id ?? 'unknown'}`,
        `IP Address: ${req.auditContext?.ip_address ?? req.ip ?? 'unknown'}`,
        `User Agent: ${req.auditContext?.user_agent ?? req.get('user-agent') ?? 'unknown'}`,
    ];

    for (const header of headersToCapture) {
        const value = req.get(header);
        if (value) {
            lines.push(`${header}: ${value}`);
        }
    }

    return lines;
}

function buildAuditLogLines(logs: Array<{
    id: string;
    created_at: Date;
    action: string;
    entity_type: string;
    entity_id: string | null;
    user_name: string | null;
    user_email: string | null;
    module_name?: string | null;
    status: string;
    ip_address: string;
    user_agent?: string;
    old_values?: Record<string, unknown> | null;
    new_values?: Record<string, unknown> | null;
}>): string[] {
    const lines: string[] = [];
    const formatJsonBlock = (value: Record<string, unknown> | null | undefined): string[] => {
        if (!value) {
            return ['null'];
        }
        return JSON.stringify(value, null, 2).split('\n');
    };

    logs.forEach((log, index) => {
        lines.push('------------------------------------------------------------');
        lines.push(`AUDIT LOG ${index + 1}`);
        lines.push('------------------------------------------------------------');
        lines.push(`Timestamp : ${new Date(log.created_at).toISOString()}`);
        lines.push(`User      : ${log.user_name || log.user_email || 'unknown'}`);
        lines.push(`Action    : ${log.action}`);
        lines.push(`Module    : ${log.module_name || 'n/a'}`);
        lines.push(`Entity    : ${log.entity_type}`);
        lines.push(`Entity ID : ${log.entity_id ?? 'n/a'}`);
        lines.push(`Status    : ${log.status}`);
        lines.push(`IP        : ${log.ip_address}`);
        lines.push(`UserAgent : ${log.user_agent || 'unknown'}`);
        lines.push(`Log ID    : ${log.id}`);
        lines.push('');
        lines.push('OLD VALUES');
        lines.push('~~~~~~~~~~');
        lines.push(...formatJsonBlock(log.old_values));
        lines.push('');
        lines.push('NEW VALUES');
        lines.push('~~~~~~~~~~');
        lines.push(...formatJsonBlock(log.new_values));
        lines.push('');
        lines.push('');

        if (index < logs.length - 1) {
            lines.push('\f');
        }
    });

    return lines;
}

export function createAuditLogsRouter(db: IDatabase<unknown>, auditLogService: AuditService, evaluationService: EvaluationService): Router {
    const router = Router();
    const organizationRepository = new OrganizationRepository(db);

    /**
     * GET /rbac/audit-logs
     * List all audit logs (paginated, decrypted)
     */
    router.get('/', requirePermission('SETTINGS', 'read', evaluationService, auditLogService), async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await withTransaction(db, async (t: TransactionTask) => {
                const pagination = parsePagination(req.query);
                const action = getOptionalQuery(req.query, 'action');
                const entityType = getOptionalQuery(req.query, 'entity_type');
                const userName = getOptionalQuery(req.query, 'user_name');
                const search = getOptionalQuery(req.query, 'search');
                
                const filters: { action?: string; entity_type?: string; user_name?: string; search?: string } = {};
                if (action) filters.action = action;
                if (entityType) filters.entity_type = entityType;
                if (userName) filters.user_name = userName;
                if (search) filters.search = search;

                const logs = await auditLogService.getAll(
                    t,
                    req.user!.id,
                    pagination,
                    filters
                );

                return logs;
            });
            sendSuccess(res, result.data, result.pagination);

        } catch (error) {
            next(error);
        }
    });

    router.get('/export/pdf', requirePermission('SETTINGS', 'export', evaluationService, auditLogService), async (req: Request, res: Response, next: NextFunction) => {
        try {
            const pdfBuffer = await withTransaction(db, async (t: TransactionTask) => {
                const pagination = parsePagination(req.query);
                const action = getOptionalQuery(req.query, 'action');
                const entityType = getOptionalQuery(req.query, 'entity_type');
                const userName = getOptionalQuery(req.query, 'user_name');
                const search = getOptionalQuery(req.query, 'search');

                const filters: { action?: string; entity_type?: string; user_name?: string; search?: string } = {};
                if (action) filters.action = action;
                if (entityType) filters.entity_type = entityType;
                if (userName) filters.user_name = userName;
                if (search) filters.search = search;

                const logs = await auditLogService.getAllDetailed(
                    t,
                    req.user!.id,
                    pagination,
                    filters
                );
                const organizations = await organizationRepository.getAll(t, { is_active: true }, { page: 1, limit: 1 });
                const companyName = organizations.data[0]?.company_name ?? 'RBAC Application';

                await auditLogService.log(t, {
                    user_id: req.user!.id,
                    action: 'export',
                    module_code: 'SETTINGS',
                    entity_type: 'audit_log',
                    new_values: {
                        page: logs.pagination.page,
                        limit: logs.pagination.limit,
                        exported_count: logs.data.length,
                        filters
                    },
                    ip_address: req.auditContext?.ip_address,
                    user_agent: req.auditContext?.user_agent,
                    status: 'success'
                });

                const lines = [
                    companyName,
                    '',
                    'Device Information',
                    '==================',
                    '',
                    ...getDeviceInfoLines(req),
                    '',
                    'Export Details',
                    '==============',
                    `Audit Logs Page: ${logs.pagination.page}`,
                    `Rows Per Page: ${logs.pagination.limit}`,
                    `Rows In Export: ${logs.data.length}`,
                    `Total Matching Rows: ${logs.pagination.total}`,
                    '',
                    'Audit Logs',
                    '==========',
                    '',
                    ...buildAuditLogLines(logs.data)
                ];

                return createPdfFromLines(lines, `${companyName} - Audit Log Export`);
            });

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="audit-logs-page-${Date.now()}.pdf"`);
            res.send(pdfBuffer);
        } catch (error) {
            next(error);
        }
    });

    /**
     * GET /rbac/audit-logs/:id
     * Get audit log by ID (decrypted)
     */
    router.get('/:id', requirePermission('SETTINGS', 'read', evaluationService, auditLogService), async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await withTransaction(db, async (t: TransactionTask) => {
                const logId = parseId(req.params.id, 'id');
                const log = await auditLogService.getById(t, req.user!.id, logId);
                return log;
            });
            sendSuccess(res, result);
        } catch (error) {
            next(error);
        }
    });

    return router;
}
