/**
 * SmtpConfigService
 *
 * Service layer for SMTP configuration management.
 * OWNS: SMTP config lifecycle
 * MUST NOT: Send emails, evaluate permissions, manage users
 */

import { IDatabase } from 'pg-promise';
import { TransactionTask } from '../../utils/transaction.utils';
import { normalizePaginationParams, PaginatedResult, PaginationParams } from '../../utils/pagination.utils';

import { SmtpConfig } from '../models/smtp_config.model';
import { ISmtpConfigRepository } from '../repositories/smtp_config.repository';
import { RBACInternalError, SMTPConfigError, SMTPConfigNotFoundError } from '../errors/rbac.errors';
import { SmtpConfigCreate, SmtpConfigUpdate } from '../dto/smtp_config.dto';
import { IAuditService } from './audit.service';
export type SmtpValidationError = string;
const MODULE_CODE = 'SETTINGS';
export type SmtpConfigReadModel = Omit<SmtpConfig, 'password'>;

function toSmtpConfigReadModel(config: SmtpConfig): SmtpConfigReadModel {
    const { password: _password, ...safeConfig } = config;
    return safeConfig;
}

function redactSmtpPassword<T extends Record<string, unknown>>(data: T): Record<string, unknown> {
    if (!Object.prototype.hasOwnProperty.call(data, 'password')) {
        return data;
    }

    return {
        ...data,
        password: '[REDACTED]'
    };
}

export interface ISmtpConfigService {
    getById(t: TransactionTask, configId: string): Promise<SmtpConfigReadModel>;
    getByIdWithSecrets(t: TransactionTask, configId: string): Promise<SmtpConfig>;
    getActiveReadModel(t: TransactionTask): Promise<SmtpConfigReadModel>;
    listAll(
        t: TransactionTask,
        filters?: { isActive?: boolean },
        paginationParams?: PaginationParams
    ): Promise<PaginatedResult<SmtpConfigReadModel>>;
    create(
        t: TransactionTask,
        data: SmtpConfigCreate,
        actingUserId: string,
        auditCtx?: AuditContext
    ): Promise<SmtpConfigReadModel>;
    getActive(t: TransactionTask): Promise<SmtpConfig>;
    update(
        t: TransactionTask,
        configId: string,
        data: SmtpConfigUpdate,
        actingUserId: string,
        auditCtx?: AuditContext
    ): Promise<SmtpConfigReadModel>;
    delete(t: TransactionTask, configId: string, actingUserId: string, auditCtx?: AuditContext): Promise<void>;
}
export function validateSmtpConfig(config: Partial<SmtpConfig>): SmtpValidationError[] {
    const errors: SmtpValidationError[] = [];

    if (!config.name || typeof config.name !== 'string') {
        errors.push('Name is required and must be a string.');
    }

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

    if (!config.username || typeof config.username !== 'string') {
        errors.push('Username is required and must be a string.');
    }

    if (!config.password || typeof config.password !== 'string') {
        errors.push('Password is required and must be a string.');
    }

    // Email checks
    if (!config.from_email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(config.from_email)) {
        errors.push('from_email must be a valid email.');
    }
    if (config.reply_to_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(config.reply_to_email)) {
        errors.push('reply_to_email must be a valid email if provided.');
    }

    if (!config.from_name || typeof config.from_name !== 'string') {
        errors.push('from_name is required and must be a string.');
    }

    return errors;
}


export class SmtpConfigService implements ISmtpConfigService {

    constructor(
        private smtpConfigRepository: ISmtpConfigRepository,
        private auditService: IAuditService
    ) { }

    /**
     * Retrieve an SMTP config by ID with audit names, excluding the password.
     * @throws SMTPConfigNotFoundError if the config does not exist.
     */
    async getById(t: TransactionTask, configId: string) {
        const config = await this.smtpConfigRepository.findByIdWithDetails(t, configId);
        if (!config) {
            throw new SMTPConfigNotFoundError(`SMTP config not found: ${configId}`);
        }
        const { password: _password, ...safeConfig } = config;
        return safeConfig;
    }

    /**
     * Retrieve an SMTP config by ID with the password included (for sending emails).
     * @throws SMTPConfigNotFoundError if the config does not exist.
     */
    async getByIdWithSecrets(t: TransactionTask, configId: string): Promise<SmtpConfig> {
        const config = await this.smtpConfigRepository.findById(t, configId);
        if (!config) {
            throw new SMTPConfigNotFoundError(`SMTP config not found: ${configId}`);
        }
        return config;
    }

    /** List all SMTP configs with optional active filter and pagination. Passwords are stripped. */
    async listAll(t: TransactionTask,
        filters?: { isActive?: boolean },
        paginationParams?: PaginationParams
    ): Promise<PaginatedResult<SmtpConfigReadModel>> {
        const params = normalizePaginationParams(paginationParams);
        const result = await this.smtpConfigRepository.findAll(t, filters, params);

        return {
            ...result,
            data: result.data.map(toSmtpConfigReadModel)
        };
    }

    /**
     * Get the currently active SMTP configuration (for use by EmailService).
     * @throws RBACInternalError if no active SMTP config is found.
     */
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

    async getActiveReadModel(t: TransactionTask): Promise<SmtpConfigReadModel> {
        const config = await this.getActive(t);
        return toSmtpConfigReadModel(config);
    }


    /**
     * Create a new SMTP configuration after validation.
     * Password is redacted in audit logs.
     * @throws SMTPConfigError if validation fails.
     */
    async create(
        t: TransactionTask,
        data: SmtpConfigCreate,
        actingUserId: string,
        auditCtx?: AuditContext
    ): Promise<SmtpConfigReadModel> {
        const errors = validateSmtpConfig(data);
        if (errors.length > 0) {
            throw new SMTPConfigError(
                `Invalid SMTP config: ${errors.join(' ')}`
            );
        }

        const config = await this.smtpConfigRepository.create(t, {
            ...data,
            created_by: actingUserId
        });
        await this.auditService.log(t, {
            user_id: actingUserId,
            action: 'create',
            module_code: MODULE_CODE,
            entity_type: 'smtp_config',
            entity_id: config.id,
            old_values: {},
            new_values: redactSmtpPassword({ ...data } as Record<string, unknown>),
            ip_address: auditCtx?.ip_address,
            user_agent: auditCtx?.user_agent,
            status: 'success'
        })
        return toSmtpConfigReadModel(config);
    }

    /**
     * Update an existing SMTP configuration after validation.
     * Password is redacted in audit logs.
     * @throws RBACInternalError if config not found or validation fails.
     */
    async update(
        t: TransactionTask,
        configId: string,
        data: SmtpConfigUpdate,
        actingUserId: string,
        auditCtx?: AuditContext
    ): Promise<SmtpConfigReadModel> {
        const existing = await this.smtpConfigRepository.findById(t, configId);
        if (!existing) {
            throw new RBACInternalError(`SMTP config not found: ${configId}`);
        }

        const updated: SmtpConfig = {
            ...existing,
            ...data,
            id: existing.id,
            version: data.version,
            updated_by: actingUserId
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
            old_values: redactSmtpPassword({ ...existing } as Record<string, unknown>),
            new_values: redactSmtpPassword({ ...updatedConfig } as Record<string, unknown>),
            ip_address: auditCtx?.ip_address,
            user_agent: auditCtx?.user_agent,
            status: 'success'
        })
        return toSmtpConfigReadModel(updatedConfig);
    }

    /**
     * Hard-delete an SMTP configuration.
     * @throws RBACInternalError if the config does not exist.
     */
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
            old_values: redactSmtpPassword({ ...existing } as Record<string, unknown>),
            new_values: { deleted: true, user_id: actingUserId } as Record<string, unknown>,
            ip_address: auditCtx?.ip_address,
            user_agent: auditCtx?.user_agent,
            status: 'success'
        })
    }
}
