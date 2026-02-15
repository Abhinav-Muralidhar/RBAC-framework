/**
 * AuditService
 * 
 * Business logic for audit logging with encryption at rest.
 * - Encrypts all fields before persistence
 * - Decrypts all fields when fetching
 * - Resolves user/role/module names via separate lookups after decryption
 */

import { AuditAction, AuditStatus } from '../models/audit_logs.model';
import { IAuditLogsRepository } from '../repositories/audit_logs.repository';
import { PaginatedResult, PaginationParams } from '../utils/pagination.utils';
import { IEvaluationService } from './evaluation.service';
import { TransactionTask } from '../utils/transaction.utils';
import { IModuleRepository } from '../repositories/modules.repository';
import { IUsersRepository } from '../repositories/users.repository';
import { IRoleRepository } from '../repositories/roles.repository';
import {
    DecryptedAuditLogRow,
    decryptAuditLogRow,
} from '../utils/crypto.utils';

export interface IAuditService {
    /**
     * Log an action (encrypts all fields before persistence)
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
    ): Promise<void>;

    /**
     * Get audit log by ID (decrypts + resolves names)
     */
    getById(
        t: TransactionTask | undefined,
        actingUserId: string,
        logId: string
    ): Promise<DecryptedAuditLogRow>;

    /**
     * Query audit logs (decrypts + resolves names, paginated)
     */
    getAll(
        t: TransactionTask | undefined,
        actingUserId: string,
        pagination?: Partial<PaginationParams>
    ): Promise<PaginatedResult<DecryptedAuditLogRow>>;
}

/**
 * AuditService Implementation
 */
export class AuditService implements IAuditService {

    constructor(
        private readonly auditLogsRepository: IAuditLogsRepository,
        private evaluationService: IEvaluationService,
        private modulesRepository: IModuleRepository,
        private usersRepository: IUsersRepository,
        private rolesRepository: IRoleRepository,
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

        // Build strict input — encryption happens in the repository layer
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

        // Decrypt
        const decrypted = decryptAuditLogRow(encryptedRow);

        // Resolve names
        await this.resolveNames(t, decrypted);

        return decrypted;
    }

    async getAll(
        t: TransactionTask | undefined,
        actingUserId: string,
        pagination?: Partial<PaginationParams>
    ): Promise<PaginatedResult<DecryptedAuditLogRow>> {
        const result = await this.auditLogsRepository.findAll(t, pagination);

        // Decrypt all rows and resolve names
        const decryptedRows: DecryptedAuditLogRow[] = [];
        for (const encryptedRow of result.data) {
            const decrypted = decryptAuditLogRow(encryptedRow);
            await this.resolveNames(t, decrypted);
            decryptedRows.push(decrypted);
        }

        return {
            data: decryptedRows,
            pagination: result.pagination,
        };
    }

    /**
     * Resolve user_name, user_email, role_name, module_name, module_code
     * by looking up the decrypted IDs against their respective repositories.
     * Mutates the row in place.
     */
    private async resolveNames(
        t: TransactionTask | undefined,
        row: DecryptedAuditLogRow
    ): Promise<void> {
        // Resolve user
        if (row.user_id) {
            try {
                const user = await this.usersRepository.findById(t as any, row.user_id);
                if (user) {
                    row.user_name = [user.first_name, user.last_name].filter(Boolean).join(' ');
                    row.user_email = user.primary_email;
                }
            } catch {
                // User may have been deleted — leave null
            }
        }

        // Resolve role
        if (row.role_id) {
            try {
                const role = await this.rolesRepository.findById(t, row.role_id);
                if (role) {
                    row.role_name = role.name;
                }
            } catch {
                // Role may have been deleted — leave null
            }
        }

        // Resolve module
        if (row.module_id) {
            try {
                const mod = await this.modulesRepository.findById(t, row.module_id);
                if (mod) {
                    row.module_name = mod.name;
                    row.module_code = mod.code;
                }
            } catch {
                // Module may have been deleted — leave null
            }
        }
    }
}