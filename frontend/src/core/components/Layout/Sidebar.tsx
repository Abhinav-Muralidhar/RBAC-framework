/**
 * Sidebar Component
 * 
 * Dynamic navigation based on user permissions.
 * Settings opens a modal from the footer section.
 * Collapsible with localStorage persistence and mobile responsiveness.
 */

import { NavLink } from 'react-router-dom';
import { useState, useEffect } from 'react';
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
import { organizationApi } from '../../api/rbac.api';
import { formatUserName } from '../../constants/userPreferences';
import type { OrganizationBrandingDto } from '../../types/organization.types';
import './Sidebar.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

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
    const [branding, setBranding] = useState<OrganizationBrandingDto | null>(null);

    useEffect(() => {
        organizationApi.getBranding().then(setBranding).catch(() => { });
    }, []);

    const logoUrl = branding?.company_logo
        ? `${API_BASE_URL}/${branding.company_logo}`
        : null;

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
                    {logoUrl ? (
                        <img src={logoUrl} alt="Logo" style={{ width: 28, height: 28, objectFit: 'contain', borderRadius: 4 }} />
                    ) : (
                        <Shield size={28} />
                    )}
                    {!isCollapsed && <span>{branding?.company_name || 'RBAC'}</span>}
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
                    title={isCollapsed ? formatUserName(user?.first_name, user?.last_name || '', user?.name_format) : undefined}
                >
                    <User size={20} />
                    {!isCollapsed && (
                        <div className="user-info">
                            <span className="user-name">{formatUserName(user?.first_name, user?.last_name || '', user?.name_format)}</span>
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
