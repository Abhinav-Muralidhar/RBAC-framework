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
import { ROUTES } from '../../../routes/routes';
import {
    LayoutDashboard,
    Settings,
    LogOut,
    User,
    Shield,
    ChevronLeft,
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

interface SidebarProps {
    isCollapsed: boolean;
    isMobile: boolean;
    isMobileOpen: boolean;
    onToggle: () => void;
    onCloseMobile: () => void;
}

export function Sidebar({ isCollapsed, isMobile, isMobileOpen, onToggle, onCloseMobile }: SidebarProps) {
    const { user, hasPermission, logout } = useAuth();
    const { openSettings } = useAdminSettings();
    const [branding, setBranding] = useState<OrganizationBrandingDto | null>(null);
    const showLabels = !isCollapsed || isMobile;
    const orgName = branding?.company_name || 'RBAC';
    const maxOrgNameLength = 20;
    const displayOrgName = orgName.length > maxOrgNameLength
        ? `${orgName.slice(0, maxOrgNameLength)}...`
        : orgName;

    useEffect(() => {
        organizationApi.getBranding().then(setBranding).catch(() => { });
    }, []);

    const logoUrl = branding?.company_logo
        ? `${API_BASE_URL}/${branding.company_logo}`
        : null;

    const handleSidebarToggle = () => {
        if (isMobile) {
            onCloseMobile();
        } else {
            onToggle();
        }
    };

    const handleLogout = async () => {
        await logout();
        window.location.href = ROUTES.LOGIN;
    };

    const handleOpenSettings = () => {
        openSettings();
        if (isMobile) {
            onCloseMobile();
        }
    };

    // Check if user can access settings
    const canAccessSettings = hasPermission('SETTINGS', 'read');

    return (
        <aside
            className={[
                'sidebar',
                isCollapsed ? 'sidebar--collapsed' : '',
                isMobile ? 'sidebar--mobile' : '',
                isMobileOpen ? 'sidebar--mobile-open' : '',
            ].filter(Boolean).join(' ')}
        >
            <div className="sidebar-header">
                <div
                    className="sidebar-logo"
                    onClick={handleSidebarToggle}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && handleSidebarToggle()}
                    aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                    title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                >
                    {logoUrl ? (
                        <img src={logoUrl} alt="Logo" className="sidebar-logo-img" />
                    ) : (
                        <Shield size={28} />
                    )}
                    {showLabels && (
                        <span className="sidebar-org-name" title={orgName}>
                            {displayOrgName}
                        </span>
                    )}
                </div>
                {showLabels && (
                    <button
                        type="button"
                        className="sidebar-collapse-btn"
                        onClick={handleSidebarToggle}
                        aria-label="Collapse sidebar"
                        title="Collapse sidebar"
                    >
                        <ChevronLeft size={18} />
                    </button>
                )}
            </div>

            <nav className="sidebar-nav">
                {navItems.map(item => (
                    <NavLink
                        key={item.id}
                        to={item.path}
                        className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                        title={!showLabels ? item.label : undefined}
                        onClick={() => isMobile && onCloseMobile()}
                    >
                        {item.icon}
                        {showLabels && <span>{item.label}</span>}
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
                        title={!showLabels ? 'Admin Settings' : undefined}
                    >
                        <Settings size={20} />
                        {showLabels && <span>Admin Settings</span>}
                    </button>
                )}

                <NavLink
                    to="/profile"
                    className="user-menu"
                    title={!showLabels ? formatUserName(user?.first_name, user?.last_name || '', user?.name_format) : undefined}
                    onClick={() => isMobile && onCloseMobile()}
                >
                    <User size={20} />
                    {showLabels && (
                        <div className="user-info">
                            <span className="user-name">{formatUserName(user?.first_name, user?.last_name || '', user?.name_format)}</span>
                            <span className="user-email">{user?.primary_email}</span>
                        </div>
                    )}
                </NavLink>
                <button
                    className="logout-btn"
                    onClick={handleLogout}
                    title={!showLabels ? 'Logout' : undefined}
                >
                    <LogOut size={18} />
                    {showLabels && <span>Logout</span>}
                </button>
            </div>
        </aside>
    );
}
