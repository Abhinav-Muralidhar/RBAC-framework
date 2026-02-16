/**
 * AppShell Component
 * 
 * Main layout wrapper with sidebar and content area.
 * Supports full-screen preview via user preference (browser fullscreen like F11).
 */

import { useEffect } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Sidebar } from './Sidebar';
import './AppShell.css';

export function AppShell() {
    const { isAuthenticated, isLoading, user } = useAuth();

    // Enter browser fullscreen when user preference is enabled
    useEffect(() => {
        if (!user) return;

        if (user.full_screen_preview && !document.fullscreenElement) {
            document.documentElement.requestFullscreen?.().catch(() => {
                // Silently fail — browser may block if there's no user gesture
            });
        } else if (!user.full_screen_preview && document.fullscreenElement) {
            document.exitFullscreen?.().catch(() => { });
        }
    }, [user?.full_screen_preview]);

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
