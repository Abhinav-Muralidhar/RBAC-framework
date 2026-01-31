/**
 * Router Configuration
 */

import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppShell } from './core/components/Layout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import {
    UsersPage,
    RolesPage,
    ProfilesPage,
    GroupsPage,
    AuditLogsPage,
} from './plugins/rbac-settings/pages';

export const router = createBrowserRouter([
    {
        path: '/login',
        element: <LoginPage />,
    },
    {
        path: '/',
        element: <AppShell />,
        children: [
            {
                index: true,
                element: <Navigate to="/dashboard" replace />,
            },
            {
                path: 'dashboard',
                element: <DashboardPage />,
            },
            // Settings Plugin (RBAC)
            {
                path: 'settings/users',
                element: <UsersPage />,
            },
            {
                path: 'settings/roles',
                element: <RolesPage />,
            },
            {
                path: 'settings/profiles',
                element: <ProfilesPage />,
            },
            {
                path: 'settings/groups',
                element: <GroupsPage />,
            },
            {
                path: 'settings/audit-logs',
                element: <AuditLogsPage />,
            },
        ],
    },
]);
