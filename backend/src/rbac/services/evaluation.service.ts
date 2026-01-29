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
        private readonly permissionsRepository: IPermissionsRepository
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
            // 1. Resolve module
            const module = await this.moduleRepository.findByCode(moduleCode);
            if (!module) {
                return createDenyDecision(
                    userId,
                    moduleCode,
                    action,
                    `Module '${moduleCode}' not found`,
                    false,
                    false
                );
            }

            // 2. Find the specific permission for this module + action
            const permission = await this.permissionsRepository.findByModuleAndAction(
                module.id,
                action as PermissionAction
            );
            if (!permission) {
                return createDenyDecision(
                    userId,
                    moduleCode,
                    action,
                    `Permission for action '${action}' on module '${moduleCode}' not found`,
                    false,
                    false
                );
            }

            // 3. Get user's roles
            const userRoles = await this.userRoleRepository.findRolesByUser(userId);
            if (userRoles.length === 0) {
                return createDenyDecision(
                    userId,
                    moduleCode,
                    action,
                    'User has no roles assigned',
                    false,
                    false
                );
            }

            // 4-6. Collect all profile IDs and check permissions
            const profileIds = new Set<string>();
            for (const userRole of userRoles) {
                const roleProfiles = await this.roleProfilesRepository.findProfilesByRole(userRole.role_id);
                for (const rp of roleProfiles) {
                    profileIds.add(rp.profile_id);
                }
            }

            if (profileIds.size === 0) {
                return createDenyDecision(
                    userId,
                    moduleCode,
                    action,
                    'No profiles assigned to user roles',
                    false,
                    false
                );
            }

            // Check each profile for the specific permission
            let hasExplicitAllow = false;
            let hasExplicitDeny = false;

            for (const profileId of profileIds) {
                const profilePermissions = await this.profilePermissionsRepository.findPermissionsByProfile(profileId);

                // Find the assignment for THIS specific permission
                const assignment = profilePermissions.find(pp => pp.permission_id === permission.id);

                if (assignment) {
                    if (assignment.effect === 'deny') {
                        hasExplicitDeny = true;
                        // Deny-override: immediately return DENY
                        return createDenyDecision(
                            userId,
                            moduleCode,
                            action,
                            `Explicit DENY for '${action}' on '${moduleCode}'`,
                            true,
                            hasExplicitAllow
                        );
                    } else if (assignment.effect === 'allow') {
                        hasExplicitAllow = true;
                    }
                }
            }

            // 7. If any ALLOW exists (and no DENY was found)
            if (hasExplicitAllow) {
                return createAllowDecision(
                    userId,
                    moduleCode,
                    action,
                    `Permission granted for '${action}' on '${moduleCode}'`,
                    hasExplicitDeny,
                    hasExplicitAllow
                );
            }

            // 8. Default: DENY (fail-closed)
            return createDenyDecision(
                userId,
                moduleCode,
                action,
                `No explicit permission for '${action}' on '${moduleCode}'`,
                hasExplicitDeny,
                hasExplicitAllow
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