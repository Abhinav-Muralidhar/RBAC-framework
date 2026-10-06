/**
 * SharingRuleService
 *
 * Business logic for sharing rule management.
 * Sharing rules control data visibility (public/private) per module.
 * All mutations are audit-logged.
 */

import { IDatabase } from 'pg-promise';
import { TransactionTask } from '../../utils/transaction.utils';
import { SharingRules, SharingRuleType } from '../models/sharing_rules.model';
import { ISharingRulesRepository } from '../repositories/sharing_rules.repository';
import { IEvaluationService } from './evaluation.service';
import { IAuditService } from './audit.service';
import { SharingRuleNotFoundError } from '../errors/rbac.errors';
import {
    UpdateSharingRuleRequestDto
} from '../dto/sharing-rule.dto';
import { PaginationParams, PaginatedResult } from '../../utils/pagination.utils';
import { assertInEnum } from '../../utils/validators';
// Module code for RBAC operations
const MODULE_CODE = 'SETTINGS';

export interface ISharingRuleService {
    /** Retrieve a sharing rule by ID with module details and audit names. */
    getById(t: TransactionTask, actingUserId: string, ruleId: string): Promise<SharingRules>;
    /** List sharing rules with optional active filter and pagination. */
    listAll(t: TransactionTask, actingUserId: string, filters?: { is_active?: boolean }, pagination?: Partial<PaginationParams>): Promise<PaginatedResult<SharingRules>>;
    /** Update a sharing rule's type (public/private) or active status. */
    update(t: TransactionTask, actingUserId: string, ruleId: string, data: UpdateSharingRuleRequestDto, auditCtx?: AuditContext): Promise<SharingRules>;
    /** Hard-delete a sharing rule. */
    delete(t: TransactionTask, actingUserId: string, ruleId: string, auditCtx?: AuditContext): Promise<void>;
}
export class SharingRuleService implements ISharingRuleService {
    constructor(
        private sharingRulesRepository: ISharingRulesRepository,
        private evaluationService: IEvaluationService,
        private auditService: IAuditService
    ) { }

    /**
     * Retrieve a sharing rule by ID with module details and audit names.
     * @throws SharingRuleNotFoundError if the rule does not exist.
     */
    async getById(t: TransactionTask, actingUserId: string, ruleId: string) {

        const rule = await this.sharingRulesRepository.findByIdWithDetails(t, ruleId);
        if (!rule) throw new SharingRuleNotFoundError(ruleId);
        return rule;
    }


    /** List all sharing rules with optional active filter and pagination. */
    async listAll(t: TransactionTask, actingUserId: string, filters?: { is_active?: boolean }, pagination?: Partial<PaginationParams>): Promise<PaginatedResult<SharingRules>> {

        return this.sharingRulesRepository.findAll(t, filters, pagination)
    }

    /**
     * Update a sharing rule's type (public/private) or active status.
     * @throws SharingRuleNotFoundError if the rule does not exist.
     */
    async update(
        t: TransactionTask,
        actingUserId: string,
        ruleId: string,
        data: UpdateSharingRuleRequestDto,
        auditCtx?: AuditContext
    ): Promise<SharingRules> {
        assertInEnum(data.rule_type, ['public', 'private'], 'Rule type');
        const existing = await this.sharingRulesRepository.findById(t, ruleId);
        if (!existing) throw new SharingRuleNotFoundError(ruleId);

        const share: SharingRules = {
            id: existing.id,
            version: data.version,
            module_id: existing.module_id,
            rule_type: data.rule_type ?? existing.rule_type,
            is_active: data.is_active ?? existing.is_active,
            created_at: existing.created_at,
            created_by: existing.created_by as string,
            updated_by: actingUserId
        };

        const updatedRule = await this.sharingRulesRepository.update(t, ruleId, share);

        await this.auditService.log(t, {
            user_id: actingUserId,
            action: 'update',
            module_code: MODULE_CODE,
            entity_type: 'sharing_rule',
            entity_id: ruleId,
            old_values: { ...existing } as Record<string, unknown>,
            new_values: { ...updatedRule } as Record<string, unknown>,
            ip_address: auditCtx?.ip_address,
            user_agent: auditCtx?.user_agent,
            status: 'success'
        })

        return updatedRule;

    }

    /**
     * Hard-delete a sharing rule.
     * @throws SharingRuleNotFoundError if the rule does not exist.
     */
    async delete(t: TransactionTask, actingUserId: string, ruleId: string, auditCtx?: AuditContext): Promise<void> {
        const existing = await this.sharingRulesRepository.findById(t, ruleId);
        if (!existing) throw new SharingRuleNotFoundError(ruleId);

        await this.sharingRulesRepository.delete(t, ruleId);

        await this.auditService.log(t, {
            user_id: actingUserId,
            action: 'delete',
            module_code: MODULE_CODE,
            entity_type: 'sharing_rule',
            entity_id: ruleId,
            old_values: { ...existing } as Record<string, unknown>,
            new_values: { deleted: true, user_id: actingUserId } as Record<string, unknown>,
            ip_address: auditCtx?.ip_address,
            user_agent: auditCtx?.user_agent,
            status: 'success'
        })
    }
}
