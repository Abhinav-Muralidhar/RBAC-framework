/**
 * Router Configuration
 * 
 * Settings pages removed - now handled by AdminSettingsModal.
 */

import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppShell } from './core/components/Layout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { ProfilePage } from './pages/ProfilePage';
import { ROUTES } from './routes/routes';

export const router = createBrowserRouter([
    {
        path: ROUTES.LOGIN,
        element: <LoginPage />,
    },
    {
        path: '/',
        element: <AppShell />,
        children: [
            {
                index: true,
                element: <Navigate to={ROUTES.DASHBOARD} replace />,
            },
            {
                path: 'dashboard',
                element: <DashboardPage />,
            },
            {
                path: 'profile',
                element: <ProfilePage />,
            },
            // Settings routes removed - handled by AdminSettingsModal
        ],
    },
]);

