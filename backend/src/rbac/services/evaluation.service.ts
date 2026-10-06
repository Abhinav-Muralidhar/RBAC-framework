/**
 * EvaluationService
 * 
 * SINGLE AUTHORITATIVE SOURCE for all permission evaluation.
 * 
 * CRITICAL RULES:
 * - This is the ONLY service that makes permission decisions
 * - All permission checks MUST flow through this service
 * - Deny-by-default: No permission = DENY
 * - Deny-override: Any DENY = DENY (even if ALLOW exists)
 * - Returns PermissionDecision (not boolean)
 * - Fail-closed on errors
 */

import { PermissionDecision, createDenyDecision, createAllowDecision } from '../types/permission-decision';
import { IPermissionsRepository } from '../repositories/permissions.repository';

import {
    PermissionDeniedError,
} from '../errors/rbac.errors';
import { PermissionAction } from '../models/permissions.model';
import { TransactionTask } from '../../utils/transaction.utils';
export interface IEvaluationService {
    /**
     * Evaluate if user has permission for module/action
     */
    evaluate(
        t: TransactionTask | undefined,
        userId: string,
        moduleCode: string,
        action: string
    ): Promise<PermissionDecision>;

    /**
     * Batch evaluate multiple permissions
     */
    evaluateBatch(
        t: TransactionTask,
        userId: string,
        requests: Array<{ moduleCode: string; action: string }>
    ): Promise<PermissionDecision[]>;

    /**
     * Check if user has permission (throws on denial)
     */
    enforcePermission(
        userId: string,
        moduleCode: string,
        action: string,
        t?: TransactionTask
    ): Promise<void>;
}

/**
 * EvaluationService Implementation
 * 
 * Framework-agnostic permission evaluation.
 * Uses repositories to resolve: User → Roles → Profiles → ProfilePermissions
 */
export class EvaluationService implements IEvaluationService {
    constructor(
        private readonly permissionsRepository: IPermissionsRepository,
    ) { }

    /**
     * Evaluate permission for a user on a specific module/action.
     * 
     * Algorithm:
     * 1. Resolve module by code
     * 2. Find the specific permission for module + action
     * 3. Get user's roles
     * 4. For each role, get assigned profiles
     * 5. For each profile, check if it has the permission assigned
     * 6. Apply deny-over-allow: Any DENY for THIS permission = DENY
     * 7. If any ALLOW exists for THIS permission = ALLOW
     * 8. Default: DENY (fail-closed)
     */
    async evaluate(
        t: TransactionTask | undefined,
        userId: string,
        moduleCode: string,
        action: string
    ): Promise<PermissionDecision> {
        try {
            const effects = await this.permissionsRepository.findEffectsByUserAndModuleAction(t,
                userId,
                moduleCode,
                action as PermissionAction
            );

            if (effects.length === 0) {
                return createDenyDecision(
                    userId,
                    moduleCode,
                    action,
                    `No permission found for '${action}' on '${moduleCode}'`,
                    false,
                    false
                );
            }

            const hasExplicitDeny = effects.includes('deny');
            const hasExplicitAllow = effects.includes('allow');

            if (hasExplicitDeny) {
                return createDenyDecision(
                    userId,
                    moduleCode,
                    action,
                    `Explicit DENY for '${action}' on '${moduleCode}'`,
                    true,
                    hasExplicitAllow
                );
            }

            if (hasExplicitAllow) {
                return createAllowDecision(
                    userId,
                    moduleCode,
                    action,
                    `Permission granted for '${action}' on '${moduleCode}'`,
                    false,
                    true
                );
            }

            return createDenyDecision(
                userId,
                moduleCode,
                action,
                `No explicit permission for '${action}' on '${moduleCode}'`,
                false,
                false
            );

        } catch (error) {
            console.error('EvaluationService.evaluate error:', error);
            return createDenyDecision(
                userId,
                moduleCode,
                action,
                'Permission evaluation failed due to internal error',
                false,
                false
            );
        }
    }

    /**
     * Batch evaluate multiple permissions for the same user.
     */
    async evaluateBatch(
        t: TransactionTask,
        userId: string,
        requests: Array<{ moduleCode: string; action: string }>
    ): Promise<PermissionDecision[]> {
        return Promise.all(
            requests.map(req => this.evaluate(t, userId, req.moduleCode, req.action))
        );
    }

    /**
     * Enforce permission - throws PermissionDeniedError if denied.
     * Used by middleware for fail-closed enforcement.
     */
    async enforcePermission(
        userId: string,
        moduleCode: string,
        action: string,
        t?: TransactionTask
    ): Promise<void> {
        const decision = await this.evaluate(t, userId, moduleCode, action);

        if (!decision.granted) {
            throw new PermissionDeniedError(userId, moduleCode, action);
        }
    }
}
