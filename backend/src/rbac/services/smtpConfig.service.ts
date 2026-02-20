/**
 * SmtpConfigService
 *
 * Service layer for SMTP configuration management.
 * OWNS: SMTP config lifecycle
 * MUST NOT: Send emails, evaluate permissions, manage users
 */

import { IDatabase } from 'pg-promise';
import { TransactionTask } from '../utils/transaction.utils';
import { normalizePaginationParams, PaginatedResult, PaginationParams } from '../utils/pagination.utils';

import { SmtpConfig, SmtpEncryption } from '../models/smtp_config.model';
import { ISmtpConfigRepository } from '../repositories/smtp_config.repository';
import { RBACInternalError, SMTPConfigError, SMTPConfigNotFoundError } from '../errors/rbac.errors';
import { SmtpConfigCreate, SmtpConfigUpdate } from '../dto/smtp_config.dto';
import { IAuditService } from './audit.service';
export type SmtpValidationError = string;
const MODULE_CODE = 'SETTINGS';
export interface ISmtpConfigService {
    getById(t: TransactionTask, configId: string): Promise<SmtpConfig>;
    listAll(
        t: TransactionTask,
        filters?: { isActive?: boolean },
        paginationParams?: PaginationParams
    ): Promise<PaginatedResult<SmtpConfig>>;
    create(
        t: TransactionTask,
        data: SmtpConfigCreate,
        actingUserId: string,
        auditCtx?: AuditContext
    ): Promise<SmtpConfig>;
    getActive(t: TransactionTask): Promise<SmtpConfig>;
    update(
        t: TransactionTask,
        configId: string,
        data: SmtpConfigUpdate,
        actingUserId: string,
        auditCtx?: AuditContext
    ): Promise<SmtpConfig>;
    delete(t: TransactionTask, configId: string, actingUserId: string, auditCtx?: AuditContext): Promise<void>;
}
export function validateSmtpConfig(config: Partial<SmtpConfig>): SmtpValidationError[] {
    const errors: SmtpValidationError[] = [];

    // Host
    if (!config.host || typeof config.host !== 'string') {
        errors.push('Host is required and must be a string.');
    }

    // Port
    if (!config.port || typeof config.port !== 'number' || config.port <= 0 || config.port > 65535) {
        errors.push('Port is required and must be a valid number between 1 and 65535.');
    }

    // Encryption
    if (!['none', 'ssl', 'tls'].includes(config.encryption ?? '')) {
        errors.push("Encryption must be one of 'none', 'ssl', or 'tls'.");
    }

    // Email checks
    if (!config.from_email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(config.from_email)) {
        errors.push('from_email must be a valid email.');
    }
    if (config.reply_to_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(config.reply_to_email)) {
        errors.push('reply_to_email must be a valid email if provided.');
    }

    return errors;
}


export class SmtpConfigService implements ISmtpConfigService {

    constructor(
        private smtpConfigRepository: ISmtpConfigRepository,
        private auditService: IAuditService
    ) { }

    async getById(t: TransactionTask, configId: string): Promise<SmtpConfig> {
        const config = await this.smtpConfigRepository.findById(t, configId);
        if (!config) {
            throw new SMTPConfigNotFoundError(`SMTP config not found: ${configId}`);
        }
        return config;
    }

    async listAll(t: TransactionTask,
        filters?: { isActive?: boolean },
        paginationParams?: PaginationParams
    ): Promise<PaginatedResult<SmtpConfig>> {
        const params = normalizePaginationParams(paginationParams);
        return this.smtpConfigRepository.findAll(t, filters, params);
    }

    // ✅ Get active SMTP config (used by EmailService)
    async getActive(t: TransactionTask): Promise<SmtpConfig> {
        const result = await this.smtpConfigRepository.findAll(
            t,
            { isActive: true },
            { page: 1, limit: 1 }
        );

        if (result.data.length === 0) {
            throw new RBACInternalError('No active SMTP configuration found');
        }

        return result.data[0]!;
    }


    async create(
        t: TransactionTask,
        data: SmtpConfigCreate,
        actingUserId: string,
        auditCtx?: AuditContext
    ): Promise<SmtpConfig> {
        const errors = validateSmtpConfig(data);
        if (errors.length > 0) {
            throw new SMTPConfigError(
                `Invalid SMTP config: ${errors.join(' ')}`
            );
        }

        const config = await this.smtpConfigRepository.create(t, data);
        await this.auditService.log(t, {
            user_id: actingUserId,
            action: 'create',
            module_code: MODULE_CODE,
            entity_type: 'smtp_config',
            entity_id: config.id,
            old_values: {},
            new_values: { ...data } as Record<string, unknown>,
            ip_address: auditCtx?.ip_address,
            user_agent: auditCtx?.user_agent,
            status: 'success'
        })
        return config;
    }

    async update(
        t: TransactionTask,
        configId: string,
        data: SmtpConfigUpdate,
        actingUserId: string,
        auditCtx?: AuditContext
    ): Promise<SmtpConfig> {
        const existing = await this.smtpConfigRepository.findById(t, configId);
        if (!existing) {
            throw new RBACInternalError(`SMTP config not found: ${configId}`);
        }

        const updated: SmtpConfig = {
            ...existing,
            ...data,
            id: existing.id,
            version: data.version,
        };
        const errors = validateSmtpConfig(updated);
        if (errors.length > 0) {
            throw new RBACInternalError(
                `Invalid SMTP config update: ${errors.join(' ')}`
            );
        }

        const updatedConfig = await this.smtpConfigRepository.update(t, configId, updated);
        await this.auditService.log(t, {
            user_id: actingUserId,
            action: 'update',
            module_code: MODULE_CODE,
            entity_type: 'smtp_config',
            entity_id: configId,
            old_values: { ...existing } as Record<string, unknown>,
            new_values: { ...updatedConfig } as Record<string, unknown>,
            ip_address: auditCtx?.ip_address,
            user_agent: auditCtx?.user_agent,
            status: 'success'
        })
        return updatedConfig;
    }

    async delete(t: TransactionTask, configId: string, actingUserId: string, auditCtx?: AuditContext): Promise<void> {
        const existing = await this.smtpConfigRepository.findById(t, configId);
        if (!existing) {
            throw new RBACInternalError(`SMTP config not found: ${configId}`);
        }

        await this.smtpConfigRepository.delete(t, configId);
        await this.auditService.log(t, {
            user_id: actingUserId,
            action: 'delete',
            module_code: MODULE_CODE,
            entity_type: 'smtp_config',
            entity_id: configId,
            old_values: { ...existing } as Record<string, unknown>,
            new_values: { deleted: true, user_id: actingUserId } as Record<string, unknown>,
            ip_address: auditCtx?.ip_address,
            user_agent: auditCtx?.user_agent,
            status: 'success'
        })
    }
}
