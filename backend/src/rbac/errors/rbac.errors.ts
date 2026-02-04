/**
 * RBAC Custom Errors
 * 
 * Production-grade error classes for RBAC system.
 * All errors extend base RBACError for consistent handling.
 */

export class RBACError extends Error {
    constructor(message: string) {
        super(message);
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
    }
}

// Custom error for sharing rules
export class SharingRuleNotFoundError extends RBACError {
    constructor(ruleId: string) {
        super(`Sharing rule not found: ${ruleId}`);
    }
}

/**
 * PermissionDeniedError
 * 
 * Thrown when user lacks required permission.
 * CRITICAL: This is the ONLY error that signals authorization failure.
 */
export class PermissionDeniedError extends RBACError {
    constructor(
        public readonly userId: string,
        public readonly moduleCode: string,
        public readonly action: string,
    ) {
        super(
            `Permission denied: User ${userId} cannot perform '${action}' on module '${moduleCode}'`
        );
    }
}

/**
 * TenantMismatchError
 * 
 * Thrown when cross-organization access is attempted.
 * CRITICAL: This prevents data leakage across tenants.
 */
//export class TenantMismatchError extends RBACError {
//    constructor(
//        public readonly expectedOrganizationId: string,
//        public readonly actualOrganizationId: string,
//        public readonly resource: string
//    ) {
//        super(
//            `Tenant mismatch: Resource '${resource}' belongs to organization ${actualOrganizationId}, ` +
//            `but request is for organization ${expectedOrganizationId}`
//        );
//    }
//}

/**
 * InvalidModuleActionError
 * 
 * Thrown when invalid module code or action is requested.
 */
export class InvalidModuleActionError extends RBACError {
    constructor(
        public readonly moduleCode: string,
        public readonly action: string
    ) {
        super(`Invalid module/action combination: module='${moduleCode}', action='${action}'`);
    }
}

/**
 * RBACInternalError
 * 
 * Thrown when internal RBAC system error occurs.
 * CRITICAL: This signals system failure, not authorization failure.
 */
export class RBACInternalError extends RBACError {
    constructor(
        message: string,
        public readonly cause?: Error
    ) {
        super(`RBAC Internal Error: ${message}`);
        // if (cause) {
        //    this.stack = `${this.stack}\nCaused by: ${cause.stack}`;
        //}
    }
}

/**
 * OrganizationNotFoundError
 */
export class OrganizationNotFoundError extends RBACError {
    constructor(public readonly organizationId: string) {
        super(`Organization not found: ${organizationId}`);
    }
}

/**
 * UserNotFoundError
 */
export class UserNotFoundError extends RBACError {
    constructor(
        public readonly userId: string
    ) {
        super(`User not found: ${userId}`);
    }
}

/**
 * RoleNotFoundError
 */
export class RoleNotFoundError extends RBACError {
    constructor(
        public readonly roleId: string
    ) {
        super(`Role not found: ${roleId}`);
    }
}

/**
 * ModuleNotFoundError
 */
export class ModuleNotFoundError extends RBACError {
    constructor(
        public readonly moduleCode: string
    ) {
        super(`Module not found: ${moduleCode}`);
    }
}

/**
 * ProfileNotFoundError
 */
export class ProfileNotFoundError extends RBACError {
    constructor(
        public readonly profileId: string
    ) {
        super(`Profile not found: ${profileId}`);
    }
}

/**
 * PermissionNotFoundError
 */
export class PermissionNotFoundError extends RBACError {
    constructor(
        public readonly permissionId: string
    ) {
        super(`Permission not found: ${permissionId}`);
    }
}

/**
 * GroupNotFoundError
 */
export class GroupNotFoundError extends RBACError {
    constructor(
        public readonly groupId: string
    ) {
        super(`Group not found: ${groupId}`);
    }
}

/**
 * CircularRoleHierarchyError
 */
export class CircularRoleHierarchyError extends RBACError {
    constructor(
        public readonly roleId: string,
        public readonly parentRoleId: string
    ) {
        super(`Circular role hierarchy detected: role ${roleId} cannot have parent ${parentRoleId}`);
    }
}

/**
 * DuplicateAssignmentError
 */
export class DuplicateAssignmentError extends RBACError {
    constructor(public readonly resource: string) {
        super(`Duplicate assignment: ${resource}`);
    }
}

/**
 * AccessDeniedError
 * 
 * Thrown when user lacks permission for a specific resource/action.
 */
export class AccessDeniedError extends RBACError {
    constructor(
        public readonly userId: string,
        public readonly action: string,
        public readonly resource: string
    ) {
        super(`Access denied: User ${userId} cannot '${action}' on '${resource}'`);
    }
}

/**
 * InvalidPasswordError
 * 
 * Thrown when password validation fails.
 */
export class InvalidPasswordError extends RBACError {
    constructor(public readonly reason: string) {
        super(`Invalid password: ${reason}`);
    }
}

/**
 * InvalidStateError
 * 
 * Thrown when an operation is attempted on an entity in an invalid state.
 */
export class InvalidStateError extends RBACError {
    constructor(
        public readonly entity: string,
        public readonly state: string,
        public readonly operation: string
    ) {
        super(`Cannot ${operation} ${entity} in state '${state}'`);
    }
}

/**
 * SoftDeletedEntityError
 * 
 * Thrown when attempting to access or modify a soft-deleted entity.
 */
export class SoftDeletedEntityError extends RBACError {
    constructor(
        public readonly entityType: string,
        public readonly entityId: string
    ) {
        super(`Entity ${entityType} with ID ${entityId} has been deleted`);
    }
}

export class ConcurrentSessionLimitError extends RBACInternalError {
    constructor(userId: string) {
        super(`Concurrent session limit exceeded for user ${userId}`);
    }
}

export class SessionNotFoundError extends RBACInternalError {
    constructor(sessionId: string) {
        super(`Session not found: ${sessionId}`);
    }
}