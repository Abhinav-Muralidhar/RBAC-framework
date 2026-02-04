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
import { RBACInternalError } from '../errors/rbac.errors';
import { SmtpConfigCreate } from '../dto/smtp_config.dto';
import { IAuditService } from './audit.service';

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
                throw new RBACInternalError(`SMTP config not found: ${configId}`);
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
            const config = await this.smtpConfigRepository.create(t, data);
            this.auditService.log(t, {
                user_id: actingUserId,
                action: 'create',
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
        data: Partial<SmtpConfig>,
        actingUserId: string
    ): Promise<SmtpConfig> {
        return withTransaction(async (t: TransactionTask) => {
            const existing = await this.smtpConfigRepository.findById(t, configId);
            if (!existing) {
                throw new RBACInternalError(`SMTP config not found: ${configId}`);
            }

            const updated: SmtpConfig = {
                id: configId,
                name: data.name ?? existing.name as string,
                host: data.host ?? existing.host as string,
                port: data.port ?? existing.port as number,
                username: data.username ?? existing.username as string,
                password: data.password ?? existing.password as string,
                encryption: data.encryption ?? existing.encryption as SmtpEncryption,
                from_email: data.from_email ?? existing.from_email as string,
                from_name: data.from_name ?? existing.from_name as string,
                reply_to_email: data.reply_to_email ?? existing.reply_to_email as string,
                is_active: data.is_active ?? existing.is_active as boolean
            };

            const updatedConfig = await this.smtpConfigRepository.update(t, configId, updated);
            this.auditService.log(t, {
                user_id: actingUserId,
                action: 'update',
                entity_type: 'smtp_config',
                entity_id: configId,
                old_values: { ...existing } as Record<string, unknown>,
                new_values: { ...updatedConfig } as Record<string, unknown>,
                status: 'success'
            }).catch(console.error);
            return updatedConfig;
        });
    }
}
