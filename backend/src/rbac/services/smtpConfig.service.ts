/**
 * SmtpConfigService
 *
 * Service layer for SMTP configuration management.
 * OWNS: SMTP config lifecycle
 * MUST NOT: Send emails, evaluate permissions, manage users
 */

import { IDatabase } from 'pg-promise';
import { TransactionTask, withTransaction } from '../utils/transaction.utils';
import { normalizePaginationParams, PaginatedResult, PaginationParams } from '../utils/pagination.utils';

import { SmtpConfig, SmtpEncryption } from '../models/smtp_config.model';
import { ISmtpConfigRepository } from '../repositories/smtp_config.repository';
import { RBACInternalError, SMTPConfigError, SMTPConfigNotFoundError } from '../errors/rbac.errors';
import { SmtpConfigCreate, SmtpConfigUpdate } from '../dto/smtp_config.dto';
import { IAuditService } from './audit.service';
export type SmtpValidationError = string;
const MODULE_CODE = 'SETTINGS';
export interface ISmtpConfigService {
    getById(configId: string): Promise<SmtpConfig>;
    listAll(
        filters?: { isActive?: boolean },
        paginationParams?: PaginationParams
    ): Promise<PaginatedResult<SmtpConfig>>;
    create(
        data: SmtpConfigCreate,
        actingUserId: string
    ): Promise<SmtpConfig>;
    update(
        configId: string,
        data: Partial<SmtpConfig>,
        actingUserId: string
    ): Promise<SmtpConfig>;
    delete(configId: string, actingUserId: string): Promise<void>;
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

    async getById(configId: string): Promise<SmtpConfig> {
        return withTransaction(async (t: TransactionTask) => {
            const config = await this.smtpConfigRepository.findById(t, configId);
            if (!config) {
                throw new SMTPConfigNotFoundError(`SMTP config not found: ${configId}`);
            }
            return config;
        });
    }

    async listAll(
        filters?: { isActive?: boolean },
        paginationParams?: PaginationParams
    ): Promise<PaginatedResult<SmtpConfig>> {
        return withTransaction(async (t: TransactionTask) => {
            const params = normalizePaginationParams(paginationParams);
            return this.smtpConfigRepository.findAll(t, filters, params);
        });
    }

    async create(
        data: SmtpConfigCreate,
        actingUserId: string
    ): Promise<SmtpConfig> {
        return withTransaction(async (t: TransactionTask) => {
            const errors = validateSmtpConfig(data);
            if (errors.length > 0) {
                throw new SMTPConfigError(
                    `Invalid SMTP config: ${errors.join(' ')}`
                );
            }

            const config = await this.smtpConfigRepository.create(t, data);
            this.auditService.log(t, {
                user_id: actingUserId,
                action: 'create',
                module_code: MODULE_CODE,
                entity_type: 'smtp_config',
                entity_id: config.id,
                old_values: {},  // No old values for create
                new_values: { ...config } as Record<string, unknown>,
                status: 'success'
            }).catch(console.error);
            return config;
        });
    }

    async update(
        configId: string,
        data: SmtpConfigUpdate,
        actingUserId: string
    ): Promise<SmtpConfig> {
        return withTransaction(async (t: TransactionTask) => {
            const existing = await this.smtpConfigRepository.findById(t, configId);
            if (!existing) {
                throw new RBACInternalError(`SMTP config not found: ${configId}`);
            }

            const updated: SmtpConfig = {
                ...existing,
                ...data,
                id: existing.id,
            };
            const errors = validateSmtpConfig(updated);
            if (errors.length > 0) {
                throw new RBACInternalError(
                    `Invalid SMTP config update: ${errors.join(' ')}`
                );
            }

            const updatedConfig = await this.smtpConfigRepository.update(t, configId, updated);
            this.auditService.log(t, {
                user_id: actingUserId,
                action: 'update',
                module_code: MODULE_CODE,
                entity_type: 'smtp_config',
                entity_id: configId,
                old_values: { ...existing } as Record<string, unknown>,
                new_values: { ...updatedConfig } as Record<string, unknown>,
                status: 'success'
            }).catch(console.error);
            return updatedConfig;
        });
    }

    async delete(configId: string, actingUserId: string): Promise<void> {
        return withTransaction(async (t: TransactionTask) => {
            const existing = await this.smtpConfigRepository.findById(t, configId);
            if (!existing) {
                throw new RBACInternalError(`SMTP config not found: ${configId}`);
            }

            await this.smtpConfigRepository.delete(t, configId);
            this.auditService.log(t, {
                user_id: actingUserId,
                action: 'delete',
                module_code: MODULE_CODE,
                entity_type: 'smtp_config',
                entity_id: configId,
                old_values: { ...existing } as Record<string, unknown>,
                new_values: { is_deleted: true } as Record<string, unknown>,
                status: 'success'
            }).catch(console.error);
        });
    }
}
