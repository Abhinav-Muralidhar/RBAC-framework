/**
 * AppShell Component
 * 
 * Main layout wrapper with sidebar and content area.
 * Supports full-screen preview via user preference (browser fullscreen like F11).
 */

import { useEffect } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Sidebar } from './Sidebar';
import { useSidebar } from '../../hooks';
import './AppShell.css';

export function AppShell() {
    const { isAuthenticated, isLoading, user } = useAuth();
    const {
        isCollapsed,
        isMobile,
        isMobileOpen,
        toggle,
        toggleMobile,
        closeMobile,
    } = useSidebar();

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

    const isSidebarOpen = isMobile ? isMobileOpen : !isCollapsed;

    return (
        <div className={`app-shell ${isCollapsed ? 'app-shell--collapsed' : ''} ${isSidebarOpen ? 'app-shell--sidebar-open' : ''}`}>
            <Sidebar
                isCollapsed={isCollapsed}
                isMobile={isMobile}
                isMobileOpen={isMobileOpen}
                onToggle={toggle}
                onCloseMobile={closeMobile}
            />
            {isMobileOpen && <button className="app-overlay" onClick={closeMobile} aria-label="Close sidebar menu" />}
            <main className="app-content">
                <button
                    className="mobile-menu-btn"
                    onClick={isMobile ? toggleMobile : toggle}
                    aria-label={isMobile ? 'Open sidebar menu' : (isCollapsed ? 'Open sidebar' : 'Close sidebar')}
                >
                    <Menu size={20} />
                </button>
                <Outlet />
            </main>
        </div>
    );
}
