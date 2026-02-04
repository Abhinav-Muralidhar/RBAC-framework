/**
 * Sidebar Component
 * 
 * Dynamic navigation based on user permissions.
 * Settings opens a modal from the footer section.
 * Collapsible with localStorage persistence and mobile responsiveness.
 */

import { NavLink } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useAdminSettings } from '../../contexts/AdminSettingsContext';
import { useSidebar } from '../../hooks';
import { ROUTES } from '../../../routes/routes';
import {
    LayoutDashboard,
    Settings,
    LogOut,
    User,
    Shield,
} from 'lucide-react';
import './Sidebar.css';

interface NavItem {
    id: string;
    label: string;
    path: string;
    icon: React.ReactNode;
}

const navItems: NavItem[] = [
    {
        id: 'dashboard',
        label: 'Dashboard',
        path: ROUTES.DASHBOARD,
        icon: <LayoutDashboard size={20} />,
    },
];

export function Sidebar() {
    const { user, hasPermission, logout } = useAuth();
    const { openSettings } = useAdminSettings();
    const { isCollapsed, toggle } = useSidebar();

    const handleLogout = async () => {
        await logout();
        window.location.href = ROUTES.LOGIN;
    };

    const handleOpenSettings = () => {
        openSettings();
    };

    // Check if user can access settings
    const canAccessSettings = hasPermission('SETTINGS', 'read');

    return (
        <aside className={`sidebar ${isCollapsed ? 'sidebar--collapsed' : ''}`}>
            <div className="sidebar-header">
                <div
                    className="sidebar-logo"
                    onClick={toggle}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && toggle()}
                    aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                    title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                >
                    <Shield size={28} />
                    {!isCollapsed && <span>RBAC</span>}
                </div>
            </div>

            <nav className="sidebar-nav">
                {navItems.map(item => (
                    <NavLink
                        key={item.id}
                        to={item.path}
                        className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                        title={isCollapsed ? item.label : undefined}
                    >
                        {item.icon}
                        {!isCollapsed && <span>{item.label}</span>}
                    </NavLink>
                ))}
            </nav>

            <div className="sidebar-footer">
                {/* Settings button - outside nav, opens modal */}
                {canAccessSettings && (
                    <button
                        className="settings-btn"
                        onClick={handleOpenSettings}
                        aria-label="Open admin settings"
                        title={isCollapsed ? 'Admin Settings' : undefined}
                    >
                        <Settings size={20} />
                        {!isCollapsed && <span>Admin Settings</span>}
                    </button>
                )}

                <NavLink
                    to="/profile"
                    className="user-menu"
                    title={isCollapsed ? `${user?.first_name} ${user?.last_name}` : undefined}
                >
                    <User size={20} />
                    {!isCollapsed && (
                        <div className="user-info">
                            <span className="user-name">{user?.first_name} {user?.last_name}</span>
                            <span className="user-email">{user?.primary_email}</span>
                        </div>
                    )}
                </NavLink>
                <button
                    className="logout-btn"
                    onClick={handleLogout}
                    title={isCollapsed ? 'Logout' : undefined}
                >
                    <LogOut size={18} />
                    {!isCollapsed && <span>Logout</span>}
                </button>
            </div>
        </aside>
    );
}
