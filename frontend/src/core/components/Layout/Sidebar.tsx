/**
 * Sidebar Component
 * 
 * Dynamic navigation for standalone RBAC framework.
 * Settings opens a modal from the footer section.
 */

import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/useAuth';
import { useAdminSettings } from '../../contexts/useAdminSettings';
import { ROUTES } from '../../../routes/routes';
import {
    LayoutDashboard,
    LogOut,
    User,
    Shield,
    Settings,
} from 'lucide-react';
import { useBranding } from '../../hooks/useBranding';
import { formatUserName } from '../../constants/userPreferences';
import './Sidebar.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const ASSET_BASE_URL = API_BASE_URL.replace(/\/v1\/?$/, '');

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
    const { user, logout } = useAuth();
    const { openSettings } = useAdminSettings();
    const navigate = useNavigate();
    const { data: branding } = useBranding();

    const logoUrl = branding?.company_logo
        ? `${ASSET_BASE_URL}/${branding.company_logo}`
        : null;

    const orgName = branding?.company_name || 'RBAC Framework';
    const maxOrgNameLength = 20;
    const displayOrgName = orgName.length > maxOrgNameLength
        ? `${orgName.slice(0, maxOrgNameLength)}...`
        : orgName;

    const handleLogout = async () => {
        await logout();
        navigate(ROUTES.LOGIN);
    };

    return (
        <aside className="sidebar sidebar--mobile-open">
            <div className="sidebar-header">
                <div className="sidebar-logo">
                    <span className="sidebar-logo-badge">
                        {logoUrl ? (
                            <img src={logoUrl} alt="Logo" className="sidebar-logo-img" />
                        ) : (
                            <Shield size={20} />
                        )}
                    </span>
                    <span className="sidebar-org-name" title={orgName}>
                        {displayOrgName}
                    </span>
                </div>
            </div>

            <nav className="sidebar-nav">
                {navItems.map(item => (
                    <NavLink
                        key={item.id}
                        to={item.path}
                        className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                    >
                        {item.icon}
                        <span>{item.label}</span>
                    </NavLink>
                ))}

                <button
                    type="button"
                    className="nav-item nav-item--button"
                    onClick={() => openSettings()}
                >
                    <Settings size={20} />
                    <span>Admin Settings</span>
                </button>
            </nav>

            <div className="sidebar-footer">
                <NavLink
                    to={ROUTES.PROFILE}
                    className="user-menu"
                >
                    <User size={20} />
                    <div className="user-info">
                        <span className="user-name">{formatUserName(user?.first_name, user?.last_name || '', user?.name_format)}</span>
                        <span className="user-email">{user?.primary_email}</span>
                    </div>
                </NavLink>
                <button
                    className="logout-btn"
                    onClick={handleLogout}
                >
                    <LogOut size={18} />
                    <span>Logout</span>
                </button>
            </div>
        </aside>
    );
}
