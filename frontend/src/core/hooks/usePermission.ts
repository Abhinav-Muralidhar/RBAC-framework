/**
 * usePermission Hook
 * 
 * Wraps AuthContext to provide convenient permission checking utilities.
 * Note: Actual enforcement happens server-side; this is for UI optimization only.
 */

import { useCallback, type FC, type ReactNode } from 'react';
import { useAuth } from '../contexts/AuthContext';

export interface UsePermissionReturn {
    /** Check if user has permission for an action on a module */
    can: (action: string, module: string) => boolean;
    /** Check multiple permissions at once */
    canAny: (checks: Array<{ action: string; module: string }>) => boolean;
    /** Check all permissions at once */
    canAll: (checks: Array<{ action: string; module: string }>) => boolean;
    /** Component for permission-based rendering */
    PermissionGate: FC<{
        module: string;
        action: string;
        fallback?: ReactNode;
        children: ReactNode;
    }>;
}

export function usePermission(): UsePermissionReturn {
    const { hasPermission } = useAuth();

    const can = useCallback((action: string, module: string): boolean => {
        return hasPermission(module, action);
    }, [hasPermission]);

    const canAny = useCallback(
        (checks: Array<{ action: string; module: string }>): boolean => {
            return checks.some(({ action, module }) => hasPermission(module, action));
        },
        [hasPermission]
    );

    const canAll = useCallback(
        (checks: Array<{ action: string; module: string }>): boolean => {
            return checks.every(({ action, module }) => hasPermission(module, action));
        },
        [hasPermission]
    );

    const PermissionGate: FC<{
        module: string;
        action: string;
        fallback?: ReactNode;
        children: ReactNode;
    }> = ({ module, action, fallback = null, children }) => {
        if (!can(action, module)) return fallback;
        return children;
    };

    return { can, canAny, canAll, PermissionGate };
}
