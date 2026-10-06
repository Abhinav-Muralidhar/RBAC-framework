/**
 * AuditService
 *
 * Business logic for audit logging with encryption at rest.
 * - Encrypts all fields before persistence
 * - Decrypts all fields when fetching
 * - Resolves user/role/module names after decryption
 */

import { AuditAction, AuditStatus } from '../models/audit_logs.model';
import { IAuditLogsRepository } from '../repositories/audit_logs.repository';
import { PaginatedResult, PaginationParams } from '../../utils/pagination.utils';
import { IEvaluationService } from './evaluation.service';
import { TransactionTask } from '../../utils/transaction.utils';
import { IModuleRepository } from '../repositories/modules.repository';
import { IUsersRepository } from '../repositories/users.repository';
import { IRoleRepository } from '../repositories/roles.repository';
import {
    computeLogHmac,
    decryptLogListRow,
    decryptLogRow,
    getLogHmacFilters,
} from '../../utils/crypto.utils';
import { DecryptedAuditLogListRow, DecryptedAuditLogRow } from '../types/repository.types';
import { AuditLogSummaryDto, AuditLogResponseDto } from '../dto/audit_log.dto';

export interface IAuditService {
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
    ): Promise<void>;

    getById(
        t: TransactionTask | undefined,
        actingUserId: string,
        logId: string
    ): Promise<DecryptedAuditLogRow>;

    getAll(
        t: TransactionTask | undefined,
        actingUserId: string,
        pagination?: Partial<PaginationParams>,
        filters?: { action?: string; entity_type?: string; user_id?: string; user_name?: string; search?: string }
    ): Promise<PaginatedResult<AuditLogSummaryDto>>;

    getAllDetailed(
        t: TransactionTask | undefined,
        actingUserId: string,
        pagination?: Partial<PaginationParams>,
        filters?: { action?: string; entity_type?: string; user_id?: string; user_name?: string; search?: string }
    ): Promise<PaginatedResult<AuditLogResponseDto>>;
}

export class AuditService implements IAuditService {
    constructor(
        private readonly auditLogsRepository: IAuditLogsRepository,
        private readonly evaluationService: IEvaluationService,
        private readonly modulesRepository: IModuleRepository,
        private readonly usersRepository: IUsersRepository,
        private readonly rolesRepository: IRoleRepository,
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
    ): Promise<void> {
        const module = await this.modulesRepository.findByCode(
            t,
            data.module_code as string
        );

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

        await this.auditLogsRepository.create(t, input);
    }

    async getById(
        t: TransactionTask | undefined,
        actingUserId: string,
        logId: string
    ): Promise<DecryptedAuditLogRow> {
        const encryptedRow = await this.auditLogsRepository.findById(t, logId);
        if (!encryptedRow) {
            throw new Error(`Audit log not found: ${logId}`);
        }

        const decrypted = decryptLogRow(encryptedRow);
        // Hydrate null name fields
        const hydrated = {
            ...decrypted,
            user_name: null,
            user_email: null,
            role_name: null,
            module_name: null,
            module_code: null,
        };
        await this.hydrateLogRows(t, [hydrated]);
        return hydrated;
    }

    async getAll(
        t: TransactionTask | undefined,
        actingUserId: string,
        pagination?: Partial<PaginationParams>,
        filters?: { action?: string; entity_type?: string; user_id?: string; user_name?: string; search?: string }
    ): Promise<PaginatedResult<AuditLogSummaryDto>> {
        const hmacFilters = getLogHmacFilters(filters as any);

        if (filters?.search) {
            const searchUserHmacs = await this.resolveUserHmacs(t, filters.search);
            hmacFilters.search_user_hmacs = [...(hmacFilters.search_user_hmacs ?? []), ...searchUserHmacs];
        }

        if (filters?.user_name) {
            const userNameHmacs = await this.resolveUserHmacs(t, filters.user_name);
            hmacFilters.search_user_hmacs = [...(hmacFilters.search_user_hmacs ?? []), ...userNameHmacs];
        }

        const result = await this.auditLogsRepository.findAll(t, pagination, hmacFilters);

        const decrypted = result.data.map((encryptedRow) => {
            const dec = decryptLogListRow(encryptedRow);
            return {
                ...dec,
                user_name: null,
                user_email: null,
            };
        });
        await this.hydrateLogRows(t, decrypted);

        return {
            data: decrypted.map((row) => ({
                id: row.id,
                action: row.action as AuditAction,
                entity_type: row.entity_type,
                entity_id: row.entity_id,
                user_name: row.user_name,
                user_email: row.user_email,
                status: row.status as AuditStatus,
                ip_address: row.ip_address,
                created_at: row.created_at,
            })),
            pagination: result.pagination,
        };
    }

    async getAllDetailed(
        t: TransactionTask | undefined,
        actingUserId: string,
        pagination?: Partial<PaginationParams>,
        filters?: { action?: string; entity_type?: string; user_id?: string; user_name?: string; search?: string }
    ): Promise<PaginatedResult<AuditLogResponseDto>> {
        const hmacFilters = getLogHmacFilters(filters as any);

        if (filters?.search) {
            const searchUserHmacs = await this.resolveUserHmacs(t, filters.search);
            hmacFilters.search_user_hmacs = [...(hmacFilters.search_user_hmacs ?? []), ...searchUserHmacs];
        }

        if (filters?.user_name) {
            const userNameHmacs = await this.resolveUserHmacs(t, filters.user_name);
            hmacFilters.search_user_hmacs = [...(hmacFilters.search_user_hmacs ?? []), ...userNameHmacs];
        }

        const result = await this.auditLogsRepository.findAllDetailed(t, pagination, hmacFilters);

        const decrypted = result.data.map((encryptedRow) => {
            const dec = decryptLogRow(encryptedRow);
            return {
                ...dec,
                user_name: null,
                user_email: null,
                role_name: null,
                module_name: null,
                module_code: null,
            };
        });
        await this.hydrateLogRows(t, decrypted);

        return {
            data: decrypted.map((row) => ({
                id: row.id,
                user_id: row.user_id,
                user_name: row.user_name,
                user_email: row.user_email,
                role_id: row.role_id,
                role_name: row.role_name,
                action: row.action as AuditAction,
                module_id: row.module_id ?? '',
                module_name: row.module_name,
                module_code: row.module_code,
                entity_type: row.entity_type,
                entity_id: row.entity_id ?? '',
                old_values: row.old_values,
                new_values: row.new_values,
                ip_address: row.ip_address,
                user_agent: row.user_agent,
                status: row.status as AuditStatus,
                created_at: row.created_at,
            })),
            pagination: result.pagination,
        };
    }

    private async hydrateLogRows(
        t: TransactionTask | undefined,
        rows: Array<any>
    ): Promise<void> {
        const userIds = [...new Set(rows.map((row) => row.user_id).filter((value): value is string => Boolean(value)))];
        const roleIds = [...new Set(rows.map((row) => row.role_id).filter((value): value is string => Boolean(value)))];
        const moduleIds = [...new Set(rows.map((row) => row.module_id).filter((value): value is string => Boolean(value)))];

        const [users, roles, modules] = await Promise.all([
            this.usersRepository.findByIds(t as any, userIds),
            this.rolesRepository.findByIds(t, roleIds),
            this.modulesRepository.findByIds(t, moduleIds)
        ]);

        const userMap = new Map(users.map((user) => [user.id, user] as const));
        const roleMap = new Map(roles.map((role) => [role.id, role] as const));
        const moduleMap = new Map(modules.map((module) => [module.id, module] as const));

        for (const row of rows) {
            if (row.user_id) {
                const user = userMap.get(row.user_id);
                if (user) {
                    row.user_name = [user.first_name, user.last_name].filter(Boolean).join(' ');
                    row.user_email = user.primary_email;
                }
            }

            if (row.role_id) {
                const role = roleMap.get(row.role_id);
                if (role) {
                    row.role_name = role.name;
                }
            }

            if (row.module_id) {
                const module = moduleMap.get(row.module_id);
                if (module) {
                    row.module_name = module.name;
                    row.module_code = module.code;
                }
            }
        }
    }

    private async resolveUserHmacs(t: TransactionTask | undefined, search: string): Promise<string[]> {
        const users = await this.usersRepository.findAllPaginated(t as any, { search }, { limit: 100 });
        const hmacs = users.data.map((user) => computeLogHmac(user.id));
        return hmacs.length > 0 ? hmacs : ['__NO_MATCH__'];
    }
}
