/**
 * SharingRuleService
 * 
 * Service layer for SharingRule management.
 * OWNS: Sharing rule lifecycle, rule validation
 * MUST NOT: Evaluate permissions, manage record shares directly, manage users/roles/groups
 */

import { SharingRules, SharingRuleType } from '../models/sharing_rules.model';
import { ISharingRulesRepository } from '../repositories/sharing_rules.repository';
import { RBACInternalError } from '../errors/rbac.errors';

// Define SharingMode type (not in model, define here)
export type SharingMode = 'read' | 'write' | 'full';

// Custom error for sharing rules
export class SharingRuleNotFoundError extends RBACInternalError {
    constructor(ruleId: string) {
        super(`Sharing rule not found: ${ruleId}`);
    }
}

export interface ISharingRuleService {
    /**
     * Get sharing rule by ID
     * @throws SharingRuleNotFoundError
     */
    getById(ruleId: string): Promise<SharingRules>;

    /**
     * List all sharing rules in organization
     */
    listAll(): Promise<SharingRules[]>;

    /**
     * List all active sharing rules in organization
     */
    listActive(): Promise<SharingRules[]>;

    /**
     * List sharing rules by type
     */
    listByType(ruleType: SharingRuleType): Promise<SharingRules[]>;

    /**
     * List sharing rules for a module
     */
    listByModule(moduleId: string): Promise<SharingRules[]>;

    /**
     * Create new sharing rule
     * @throws SharingRuleCreationError
     */
    create(
        data: {
            rule_type: SharingRuleType;
            sharing_mode: SharingMode;
            module_id: string;
            is_active?: boolean;
        },
        actingUserId: string
    ): Promise<SharingRules>;

    /**
     * Update sharing rule
     * @throws SharingRuleNotFoundError
     */
    update(
        ruleId: string,
        data: Partial<SharingRules>,
        actingUserId: string
    ): Promise<SharingRules>;

    /**
     * Delete sharing rule
     * @throws SharingRuleNotFoundError
     */
    delete(
        ruleId: string,
        actingUserId: string
    ): Promise<void>;
}

/**
 * SharingRuleService implementation
 */
export class SharingRuleService implements ISharingRuleService {
    constructor(private sharingRulesRepository: ISharingRulesRepository) { }

    async getById(ruleId: string): Promise<SharingRules> {
        const rule = await this.sharingRulesRepository.findById(ruleId);
        if (!rule) {
            throw new SharingRuleNotFoundError(ruleId);
        }
        return rule;
    }

    async listAll(): Promise<SharingRules[]> {
        return this.sharingRulesRepository.findAll();
    }

    async listActive(): Promise<SharingRules[]> {
        return this.sharingRulesRepository.findActive();
    }

    async listByType(ruleType: SharingRuleType): Promise<SharingRules[]> {
        return this.sharingRulesRepository.findByType(ruleType);
    }

    async listByModule(moduleId: string): Promise<SharingRules[]> {
        return this.sharingRulesRepository.findByModule(moduleId);
    }

    async create(
        data: {
            rule_type: SharingRuleType;
            sharing_mode: SharingMode;
            module_id: string;
            is_active?: boolean;
        },
        _actingUserId: string
    ): Promise<SharingRules> {
        return this.sharingRulesRepository.create({
            rule_type: data.rule_type,
            module_id: data.module_id,
            is_active: data.is_active ?? true
        });
    }

    async update(
        ruleId: string,
        data: Partial<SharingRules>,
        _actingUserId: string
    ): Promise<SharingRules> {
        const existing = await this.sharingRulesRepository.findById(ruleId);
        if (!existing) {
            throw new SharingRuleNotFoundError(ruleId);
        }

        return this.sharingRulesRepository.update(ruleId, data);
    }

    async delete(ruleId: string, _actingUserId: string): Promise<void> {
        const existing = await this.sharingRulesRepository.findById(ruleId);
        if (!existing) {
            throw new SharingRuleNotFoundError(ruleId);
        }

        return this.sharingRulesRepository.delete(ruleId);
    }
}