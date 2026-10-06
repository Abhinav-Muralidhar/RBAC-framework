import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';
import { ROUTES } from '../../routes/routes';

interface ProtectedRouteProps {
    module: string;
    action: string;
    children: ReactNode;
}

export function ProtectedRoute({ module, action, children }: ProtectedRouteProps) {
    const { hasPermission } = useAuth();

    if (!hasPermission(module, action)) {
        return <Navigate to={ROUTES.UNAUTHORIZED} replace />;
    }

    return <>{children}</>;
}
