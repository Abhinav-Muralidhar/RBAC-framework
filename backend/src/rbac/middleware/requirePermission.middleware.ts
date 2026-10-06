/**
 * requirePermission Middleware
 * 
 * Express middleware for enforcing RBAC permissions.
 * 
 * CRITICAL RULES:
 * - NO permission logic here
 * - Delegates ALL decisions to EvaluationService
 * - Fail-closed on ANY error
 * - Audits ALL denials
 * - Translates domain errors to HTTP responses
 * 
 * Usage:
 *   router.post('/invoices', requirePermission('INVOICES', 'create'), controller.create)
 */

import { Request, Response, NextFunction } from 'express';
import { IEvaluationService } from '../services/evaluation.service';
import { IAuditService } from '../services/audit.service';
import {
    PermissionDeniedError,
    InvalidModuleActionError,
    RBACInternalError
} from '../errors/rbac.errors';
import { badRequest, forbidden, internalError, unauthorized } from '../errors/api.errors';

// Uses global Request type augmentation from types/express.d.ts
// which adds user?: { id: string; sessionId?: string; }

/**
 * Middleware factory
 * 
 * @param moduleCode - Module code (e.g., 'INVOICES', 'LEADS')
 * @param action - Action (e.g., 'create', 'read', 'update', 'delete', 'export')
 * @param evaluationService - Injected evaluation service
 * @param auditService - Injected audit service
 */
export function requirePermission(
    moduleCode: string,
    action: string,
    evaluationService: IEvaluationService,
    auditService: IAuditService
) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            // FAIL-CLOSED: Missing user
            if (!req.user) {
                return next(unauthorized('Authentication required', 'AUTH_REQUIRED'));
            }

            // FAIL-CLOSED: Missing user ID
            if (!req.user.id) {
                return next(unauthorized('Invalid user context: missing user ID', 'INVALID_USER_CONTEXT'));
            }

            const { id: userId } = req.user;

            // Delegate to evaluation service
            try {
                await evaluationService.enforcePermission(
                    userId,
                    moduleCode,
                    action
                );

                // Permission granted - proceed
                next();

            } catch (error) {
                // Handle domain errors
                if (error instanceof PermissionDeniedError) {
                    // Audit denial
                    await auditService.log(undefined, {
                        user_id: userId,
                        action: 'update',
                        entity_type: 'permission_check',
                        entity_id: `${moduleCode}:${action}`,
                        status: 'failure',
                        ip_address: req.ip,
                        user_agent: req.get('user-agent'),
                        old_values: null,
                        new_values: {
                            moduleCode: error.moduleCode,
                            action: error.action,
                            message: error.message
                        }
                    }).catch(() => { });

                    return next(forbidden(error.message, 'PERMISSION_DENIED', {
                        moduleCode: error.moduleCode,
                        action: error.action
                    }));
                }

                if (error instanceof InvalidModuleActionError) {
                    await auditService.log(undefined, {
                        user_id: userId,
                        action: 'update',
                        entity_type: 'permission_check',
                        entity_id: `${moduleCode}:${action}`,
                        status: 'failure',
                        ip_address: req.ip,
                        user_agent: req.get('user-agent'),
                        old_values: null,
                        new_values: { reason: 'INVALID_MODULE_ACTION' }
                    }).catch(() => { });

                    return next(badRequest(error.message, 'INVALID_MODULE_ACTION'));
                }

                if (error instanceof RBACInternalError) {
                    // FAIL-CLOSED: Internal error = deny access
                    console.error('RBAC Internal Error:', error);

                    await auditService.log(undefined, {
                        user_id: userId,
                        action: 'update',
                        entity_type: 'permission_check',
                        entity_id: `${moduleCode}:${action}`,
                        status: 'failure',
                        ip_address: req.ip,
                        user_agent: req.get('user-agent'),
                        old_values: null,
                        new_values: { reason: 'RBAC_INTERNAL_ERROR' }
                    }).catch(() => { });

                    return next(internalError('Permission evaluation failed', 'RBAC_INTERNAL_ERROR'));
                }

                // FAIL-CLOSED: Unknown error = deny access
                console.error('Unknown error in permission middleware:', error);

                await auditService.log(undefined, {
                    user_id: userId,
                    action: 'update',
                    entity_type: 'permission_check',
                    entity_id: `${moduleCode}:${action}`,
                    status: 'failure',
                    ip_address: req.ip,
                    user_agent: req.get('user-agent'),
                    old_values: null,
                    new_values: { reason: 'UNKNOWN_ERROR' }
                }).catch(() => { });

                return next(internalError('Permission evaluation failed', 'UNKNOWN_ERROR'));
            }

        } catch (error) {
            // FAIL-CLOSED: Outer catch for any unexpected errors
            console.error('Critical error in permission middleware:', error);

            if (req.user?.id) {
                await auditService.log(undefined, {
                    user_id: req.user.id,
                    action: 'update',
                    entity_type: 'permission_check',
                    entity_id: `${moduleCode}:${action}`,
                    status: 'failure',
                    ip_address: req.ip,
                    user_agent: req.get('user-agent'),
                    old_values: null,
                    new_values: { reason: 'MIDDLEWARE_ERROR' }
                }).catch(() => { });
            }

            return next(internalError('Permission check failed', 'MIDDLEWARE_ERROR'));
        }
    };
}
