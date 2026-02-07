/**
 * PermissionDecision
 * 
 * Result of permission evaluation.
 */

export interface PermissionDecision {
    /**
     * Whether access is granted
     */
    readonly granted: boolean;

    /**
     * Reason for decision (required for denials, optional for grants)
     */
    readonly reason: string;

    /**
     * User ID evaluated
     */
    readonly userId: string;

    /**
     * Organization ID evaluated
     */
    //readonly organizationId: string;

    /**
     * Module code evaluated
     */
    readonly moduleCode: string;

    /**
     * Action evaluated
     */
    readonly action: string;

    /**
     * Timestamp of evaluation
     */
    readonly evaluatedAt: Date;

    /**
     * Whether any explicit DENY was found
     */
    readonly hadExplicitDeny: boolean;

    /**
     * Whether any explicit ALLOW was found
     */
    readonly hadExplicitAllow: boolean;
}

/**
 * Create a DENY decision
 * CRITICAL: Fail-closed by default
 */
export function createDenyDecision(
    userId: string,
    //organizationId: string,
    moduleCode: string,
    action: string,
    reason: string,
    hadExplicitDeny: boolean = false,
    hadExplicitAllow: boolean = false
): PermissionDecision {
    return {
        granted: false,
        reason,
        userId,
        //organizationId,
        moduleCode,
        action,
        evaluatedAt: new Date(),
        hadExplicitDeny,
        hadExplicitAllow
    };
}

/**
 * Create an ALLOW decision
 */
export function createAllowDecision(
    userId: string,
    //organizationId: string,
    moduleCode: string,
    action: string,
    reason: string,
    hadExplicitDeny: boolean = false,
    hadExplicitAllow: boolean = true
): PermissionDecision {
    return {
        granted: true,
        reason,
        userId,
        //organizationId,
        moduleCode,
        action,
        evaluatedAt: new Date(),
        hadExplicitDeny,
        hadExplicitAllow
    };
}
