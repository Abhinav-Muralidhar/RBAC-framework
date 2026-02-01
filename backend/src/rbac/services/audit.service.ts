/**
 * AuditService
 * 
 * Business logic for audit logging.
 * NO permission evaluation logic here.
 */

import { AuditLogs, AuditAction, AuditStatus } from '../models/audit_logs.model';
import { IAuditLogsRepository } from '../repositories/audit_logs.repository';

export interface IAuditService {
    /**
     * Log an action
     * 
     * CRITICAL: This should be called for all permission-sensitive operations.
     * Audit logs are append-only.
     */
    log(
        data: {
            user_id?: string;
            role_id?: string;
            action: AuditAction;
            module_id?: string;
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
     * @throws AuditLogNotFoundError
     */
    getById(logId: string): Promise<AuditLogs>;

    /**
     * Query audit logs by user
     */
    getByUser(
        userId: string,
        limit?: number,
        offset?: number
    ): Promise<AuditLogs[]>;

    /**
     * Query audit logs by entity
     */
    getByEntity(
        entityType: string,
        entityId: string,
        limit?: number,
        offset?: number
    ): Promise<AuditLogs[]>;

    /**
     * Query audit logs by action
     */
    getByAction(
        action: AuditAction,
        limit?: number,
        offset?: number
    ): Promise<AuditLogs[]>;

    /**
     * Query audit logs by date range
     */
    getByDateRange(
        startDate: Date,
        endDate: Date,
        limit?: number,
        offset?: number
    ): Promise<AuditLogs[]>;

    /**
     * Query all audit logs
     */
    getAll(
        limit?: number,
        offset?: number
    ): Promise<AuditLogs[]>;
}

/**
 * AuditService Implementation
 */
export class AuditService implements IAuditService {
    constructor(private readonly auditLogsRepository: IAuditLogsRepository) { }

    async log(data: {
        user_id?: string;
        role_id?: string;
        action: AuditAction;
        module_id?: string;
        entity_type?: string;
        entity_id?: string;
        old_values?: Record<string, unknown> | null;
        new_values?: Record<string, unknown>;
        ip_address?: string | undefined;
        user_agent?: string | undefined;
        status: AuditStatus;
    }): Promise<AuditLogs> {
        // Build strict input object - all required fields must have values
        const input = {
            action: data.action,
            module_id: data.module_id || '',
            entity_type: data.entity_type || '',
            entity_id: data.entity_id || '',
            ip_address: data.ip_address || '',
            user_agent: data.user_agent || '',
            status: data.status,
            user_id: data.user_id ?? null,
            role_id: data.role_id ?? null,
            old_values: data.old_values ?? null,
            new_values: data.new_values ?? null
        };

        return this.auditLogsRepository.create(input);
    }

    async getById(logId: string): Promise<AuditLogs> {
        const log = await this.auditLogsRepository.findById(logId);
        if (!log) {
            throw new Error(`Audit log not found: ${logId}`);
        }
        return log;
    }

    async getByUser(userId: string, limit?: number, offset?: number): Promise<AuditLogs[]> {
        return this.auditLogsRepository.findByUser(userId, limit, offset);
    }

    async getByEntity(entityType: string, entityId: string, limit?: number, offset?: number): Promise<AuditLogs[]> {
        return this.auditLogsRepository.findByEntity(entityType, entityId, limit, offset);
    }

    async getByAction(action: AuditAction, limit?: number, offset?: number): Promise<AuditLogs[]> {
        return this.auditLogsRepository.findByAction(action, limit, offset);
    }

    async getByDateRange(startDate: Date, endDate: Date, limit?: number, offset?: number): Promise<AuditLogs[]> {
        return this.auditLogsRepository.findByDateRange(startDate, endDate, limit, offset);
    }

    async getAll(limit?: number, offset?: number): Promise<AuditLogs[]> {
        return this.auditLogsRepository.findAll(limit, offset);
    }
}
