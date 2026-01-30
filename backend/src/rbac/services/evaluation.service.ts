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
import { IModuleRepository } from '../repositories/modules.repository';
import { IUserRoleRepository } from '../repositories/user_roles.repository';
import { IRoleProfilesRepository } from '../repositories/role_profiles.repository';
import { IProfilePermissionsRepository } from '../repositories/profile_permissions.repository';
import { IPermissionsRepository } from '../repositories/permissions.repository';
import { IUsersRepository } from '../repositories/users.repository';
import {
    PermissionDeniedError,
    InvalidModuleActionError,
    RBACInternalError
} from '../errors/rbac.errors';
import { PermissionAction } from '../models/permissions.model';

export interface IEvaluationService {
    /**
     * Evaluate if user has permission for module/action
     */
    evaluate(
        userId: string,
        moduleCode: string,
        action: string
    ): Promise<PermissionDecision>;

    /**
     * Batch evaluate multiple permissions
     */
    evaluateBatch(
        userId: string,
        requests: Array<{ moduleCode: string; action: string }>
    ): Promise<PermissionDecision[]>;

    /**
     * Check if user has permission (throws on denial)
     */
    enforcePermission(
        userId: string,
        moduleCode: string,
        action: string
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
        private readonly moduleRepository: IModuleRepository,
        private readonly userRoleRepository: IUserRoleRepository,
        private readonly roleProfilesRepository: IRoleProfilesRepository,
        private readonly profilePermissionsRepository: IProfilePermissionsRepository,
        private readonly permissionsRepository: IPermissionsRepository,
        private readonly usersRepository: IUsersRepository
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
        userId: string,
        moduleCode: string,
        action: string
    ): Promise<PermissionDecision> {
        try {
            // OPTIMIZED: Single JOIN query instead of 6+ sequential queries
            // Traverses: users -> user_roles -> role_profiles -> profile_permissions -> permissions -> modules
            const effects = await this.permissionsRepository.findEffectsByUserAndModuleAction(
                userId,
                moduleCode,
                action as PermissionAction
            );

            // No effects found = no permission assigned
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

            // Deny-override: any 'deny' effect = DENY (even if 'allow' exists)
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

            // Has allow (and no deny)
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

            // Fallback: DENY (fail-closed)
            return createDenyDecision(
                userId,
                moduleCode,
                action,
                `No explicit permission for '${action}' on '${moduleCode}'`,
                false,
                false
            );

        } catch (error) {
            // Fail-closed on any error
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
        userId: string,
        requests: Array<{ moduleCode: string; action: string }>
    ): Promise<PermissionDecision[]> {
        const results: PermissionDecision[] = [];
        for (const req of requests) {
            const decision = await this.evaluate(userId, req.moduleCode, req.action);
            results.push(decision);
        }
        return results;
    }

    /**
     * Enforce permission - throws PermissionDeniedError if denied.
     * Used by middleware for fail-closed enforcement.
     */
    async enforcePermission(
        userId: string,
        moduleCode: string,
        action: string
    ): Promise<void> {
        const decision = await this.evaluate(userId, moduleCode, action);

        if (!decision.granted) {
            throw new PermissionDeniedError(userId, moduleCode, action);
        }
    }
}