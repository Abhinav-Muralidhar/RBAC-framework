/**
 * AppShell Component
 * 
 * Main layout wrapper with sidebar and content area.
 */

import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Sidebar } from './Sidebar';
import './AppShell.css';

export function AppShell() {
    const { isAuthenticated, isLoading } = useAuth();

    if (isLoading) {
        return (
            <div className="app-loading">
                <div className="spinner"></div>
                <p>Loading...</p>
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    return (
        <div className="app-shell">
            <Sidebar />
            <main className="app-content">
                <Outlet />
            </main>
        </div>
    );
}
