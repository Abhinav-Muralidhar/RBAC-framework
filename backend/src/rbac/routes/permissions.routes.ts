import { Router, Request, Response, NextFunction } from 'express';
import { IDatabase } from 'pg-promise';
import { PermissionService } from '../services/permission.service';
import { ModuleService } from '../services/module.service';
import { TransactionTask, withTransaction } from '../../utils/transaction.utils';
import { EvaluationService } from '../services/evaluation.service';
import { AuditService } from '../services/audit.service';
import { requirePermission } from '../middleware/requirePermission.middleware';
import { sendSuccess } from './_response';


export interface ModulePermission {
    id: string;
    module_id: string;
    action: string;
    description: string | null | undefined;
    module_name: string;
    module_code: string;
}

export function createPermissionsRouter(
    db: IDatabase<unknown>,
    permissionService: PermissionService,
    moduleService: ModuleService,
    evaluationService: EvaluationService,
    auditService: AuditService
): Router {
    const router = Router();

    /**
     * GET /rbac/permissions
     * List all permissions with associated module data (paginated)
     */
    router.get('/', requirePermission('SETTINGS', 'read', evaluationService, auditService), async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await withTransaction(db, async (t: TransactionTask) => {

                const actingUserId = req.user!.id; // Assuming user ID is set in the req
                // Here, you can also use filters from query params if needed
                const permissions = await permissionService.listAllPermissions(t, actingUserId);
                const modules = await moduleService.getAll(t, actingUserId);

                // Map modules to quick lookup by ID
                const moduleMap = modules.reduce((acc, module) => {
                    acc[module.id] = module;
                    return acc;
                }, {} as Record<string, { name: string; code: string }>);

                // Format permissions with their associated module names and codes
                const permissionsWithModules: ModulePermission[] = permissions.map(p => ({
                    id: p.id,
                    module_id: p.module_id,
                    action: p.action,
                    description: p.description,
                    module_name: moduleMap[p.module_id]?.name || 'Unknown',
                    module_code: moduleMap[p.module_id]?.code || 'Unknown'
                }));

                return permissionsWithModules;
            });

            // Send the formatted response
            sendSuccess(res, result);
        } catch (error) {
            next(error);
        }
    });


    return router;
}
