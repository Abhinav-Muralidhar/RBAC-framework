/**
 * AuditService
 * 
 * Business logic for audit logging.
 * NO permission evaluation logic here.
 */

import { AuditLogs, AuditAction, AuditStatus } from '../models/audit_logs.model';
import { AuditLogWithDetailsRow, IAuditLogsRepository } from '../repositories/audit_logs.repository';
import { PaginatedResult, PaginationParams } from '../utils/pagination.utils';
import { AuditLogFilters } from '../types/repository.types';
import { IEvaluationService } from './evaluation.service';
import { TransactionTask, withTransaction } from '../utils/transaction.utils'; // adjust path if needed
import { IDatabase } from 'pg-promise';
import { IModuleRepository } from '../repositories/modules.repository';
const MODULE_CODE = 'SETTINGS';

export interface IAuditService {
    /**
     * Log an action
     * 
     * CRITICAL: This should be called for all permission-sensitive operations.
     * Audit logs are append-only.
     */
    log(
        t: TransactionTask | undefined,
        data: {
            user_id?: string;
            role_id?: string;
            action: AuditAction;
            module_id?: string;
            module_code?: string;
            entity_type?: string;
            entity_id?: string;
            old_values?: Record<string, unknown> | null;
            new_values?: Record<string, unknown>;
            ip_address?: string | undefined;
            user_agent?: string | undefined;
            status: AuditStatus;
        }
    ): Promise<AuditLogs>;

    /**
     * Get audit log by ID
     */
    getById(
        t: TransactionTask | undefined,
        actingUserId: string,
        logId: string
    ): Promise<AuditLogWithDetailsRow>;

    /**
     * Query audit logs with optional filters
     */
    getAll(
        t: TransactionTask | undefined,
        actingUserId: string,
        filters?: AuditLogFilters,
        pagination?: Partial<PaginationParams>
    ): Promise<PaginatedResult<AuditLogWithDetailsRow>>;
}

/**
 * AuditService Implementation
 */
export class AuditService implements IAuditService {

    constructor(
        private readonly auditLogsRepository: IAuditLogsRepository,
        private evaluationService: IEvaluationService,
        private modulesRepository: IModuleRepository,
    ) { }

    async log(
        t: TransactionTask | undefined,
        data: {
            user_id?: string;
            role_id?: string;
            action: AuditAction;
            module_id?: string;
            module_code?: string;
            entity_type?: string;
            entity_id?: string;
            old_values?: Record<string, unknown> | null;
            new_values?: Record<string, unknown>;
            ip_address?: string | undefined;
            user_agent?: string | undefined;
            status: AuditStatus;
        }
    ): Promise<AuditLogs> {

        const module = await this.modulesRepository.findByCode(
            t,
            data.module_code as string
        );
        // Build strict input object - all required fields must have values
        const input = {
            action: data.action,
            module_id: module?.id ?? null,
            entity_type: data.entity_type ?? '',
            entity_id: data.entity_id ?? null,
            ip_address: data.ip_address || '',
            user_agent: data.user_agent || '',
            status: data.status,
            user_id: data.user_id ?? null,
            role_id: data.role_id ?? null,
            old_values: data.old_values ?? null,
            new_values: data.new_values ?? null
        };

        return this.auditLogsRepository.create(t, input);
    }

    async getById(
        t: TransactionTask | undefined,
        actingUserId: string,
        logId: string
    ): Promise<AuditLogWithDetailsRow> {
        const log = await this.auditLogsRepository.findByIdWithDetails(t, logId);
        if (!log) {
            throw new Error(`Audit log not found: ${logId}`);
        }
        return log;
    }

    async getAll(t: TransactionTask | undefined, actingUserId: string, filters: AuditLogFilters = {}, pagination?: Partial<PaginationParams>): Promise<PaginatedResult<AuditLogWithDetailsRow>> {
        return this.auditLogsRepository.findAllWithDetails(t, filters, pagination);
    }
}