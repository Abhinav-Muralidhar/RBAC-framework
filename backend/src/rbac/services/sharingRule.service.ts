/**
 * SharingRuleService
 * 
 * Service layer for SharingRule management.
 * All mutating operations require RBAC enforcement.
 * All mutations are audit logged.
 */

import { SharingRules, SharingRuleType } from '../models/sharing_rules.model';
import { ISharingRulesRepository } from '../repositories/sharing_rules.repository';
import { IEvaluationService } from './evaluation.service';
import { IAuditService } from './audit.service';
import { RBACInternalError } from '../errors/rbac.errors';
import { SharingRuleListFilterDto, CreateSharingRuleRequestDto, UpdateSharingRuleRequestDto } from '../dto/sharing-rule.dto';
import { PaginationParams, PaginatedResult } from '../utils/pagination.utils';

// Module code for RBAC operations
const MODULE_CODE = 'SETTINGS';

// Define SharingMode type
export type SharingMode = 'read' | 'write' | 'full';

// Custom error for sharing rules
export class SharingRuleNotFoundError extends RBACInternalError {
    constructor(ruleId: string) {
        super(`Sharing rule not found: ${ruleId}`);
    }
}

export interface ISharingRuleService {
    getById(actingUserId: string, ruleId: string): Promise<SharingRules>;
    listAll(actingUserId: string): Promise<SharingRules[]>;
    listPaginated(actingUserId: string, filters?: SharingRuleListFilterDto, pagination?: Partial<PaginationParams>): Promise<PaginatedResult<SharingRules>>;
    listActive(actingUserId: string): Promise<SharingRules[]>;
    listByType(actingUserId: string, ruleType: SharingRuleType): Promise<SharingRules[]>;
    listByModule(actingUserId: string, moduleId: string): Promise<SharingRules[]>;
    create(actingUserId: string, data: CreateSharingRuleRequestDto): Promise<SharingRules>;
    update(actingUserId: string, ruleId: string, data: UpdateSharingRuleRequestDto): Promise<SharingRules>;
    delete(actingUserId: string, ruleId: string): Promise<void>;
}

export class SharingRuleService implements ISharingRuleService {
    constructor(
        private sharingRulesRepository: ISharingRulesRepository,
        private evaluationService: IEvaluationService,
        private auditService: IAuditService
    ) { }

    async getById(actingUserId: string, ruleId: string): Promise<SharingRules> {
        await this.evaluationService.enforcePermission(actingUserId, MODULE_CODE, 'read');

        const rule = await this.sharingRulesRepository.findById(ruleId);
        if (!rule) {
            throw new SharingRuleNotFoundError(ruleId);
        }
        return rule;
    }

    async listAll(actingUserId: string): Promise<SharingRules[]> {
        await this.evaluationService.enforcePermission(actingUserId, MODULE_CODE, 'read');
        return this.sharingRulesRepository.findAll();
    }

    async listPaginated(
        actingUserId: string,
        filters?: SharingRuleListFilterDto,
        pagination?: Partial<PaginationParams>
    ): Promise<PaginatedResult<SharingRules>> {
        await this.evaluationService.enforcePermission(actingUserId, MODULE_CODE, 'read');
        return this.sharingRulesRepository.findAllPaginated(filters, pagination);
    }

    async listActive(actingUserId: string): Promise<SharingRules[]> {
        await this.evaluationService.enforcePermission(actingUserId, MODULE_CODE, 'read');
        return this.sharingRulesRepository.findActive();
    }

    async listByType(actingUserId: string, ruleType: SharingRuleType): Promise<SharingRules[]> {
        await this.evaluationService.enforcePermission(actingUserId, MODULE_CODE, 'read');
        return this.sharingRulesRepository.findByType(ruleType);
    }

    async listByModule(actingUserId: string, moduleId: string): Promise<SharingRules[]> {
        await this.evaluationService.enforcePermission(actingUserId, MODULE_CODE, 'read');
        return this.sharingRulesRepository.findByModule(moduleId);
    }

    async create(actingUserId: string, data: CreateSharingRuleRequestDto): Promise<SharingRules> {
        await this.evaluationService.enforcePermission(actingUserId, MODULE_CODE, 'create');

        const rule = await this.sharingRulesRepository.create({
            rule_type: data.rule_type,
            module_id: data.module_id,
            is_active: data.is_active ?? true,
            created_by: actingUserId
        });

        // AUDIT: Log sharing rule creation (fire-and-forget)
        this.auditService.log({
            user_id: actingUserId,
            action: 'create',
            entity_type: 'sharing_rule',
            entity_id: rule.id,
            old_values: null,
            new_values: { ...data } as Record<string, unknown>,
            status: 'success'
        }).catch(console.error);

        return rule;
    }

    async update(actingUserId: string, ruleId: string, data: UpdateSharingRuleRequestDto): Promise<SharingRules> {
        await this.evaluationService.enforcePermission(actingUserId, MODULE_CODE, 'update');

        const existing = await this.sharingRulesRepository.findById(ruleId);
        if (!existing) {
            throw new SharingRuleNotFoundError(ruleId);
        }

        const updatedRule = await this.sharingRulesRepository.update(ruleId, data);

        // AUDIT: Log sharing rule update (fire-and-forget)
        this.auditService.log({
            user_id: actingUserId,
            action: 'update',
            entity_type: 'sharing_rule',
            entity_id: ruleId,
            old_values: { ...existing } as Record<string, unknown>,
            new_values: { ...data } as Record<string, unknown>,
            status: 'success'
        }).catch(console.error);

        return updatedRule;
    }

    async delete(actingUserId: string, ruleId: string): Promise<void> {
        await this.evaluationService.enforcePermission(actingUserId, MODULE_CODE, 'delete');

        const existing = await this.sharingRulesRepository.findById(ruleId);
        if (!existing) {
            throw new SharingRuleNotFoundError(ruleId);
        }

        await this.sharingRulesRepository.delete(ruleId);

        // AUDIT: Log sharing rule deletion (fire-and-forget)
        this.auditService.log({
            user_id: actingUserId,
            action: 'delete',
            entity_type: 'sharing_rule',
            entity_id: ruleId,
            old_values: { ...existing } as Record<string, unknown>,
            new_values: { is_deleted: true },
            status: 'success'
        }).catch(console.error);
    }
}