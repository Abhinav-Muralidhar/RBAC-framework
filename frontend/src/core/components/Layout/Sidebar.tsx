/**
 * Sidebar Component
 * 
 * Dynamic navigation based on user permissions.
 * Settings is a module - only visible if user has SETTINGS permission.
 */

import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
    LayoutDashboard,
    Settings,
    Users,
    Shield,
    Key,
    FolderTree,
    FileText,
    LogOut,
    ChevronDown,
    ChevronRight,
    User,
} from 'lucide-react';
import './Sidebar.css';

interface NavItem {
    id: string;
    label: string;
    path: string;
    icon: React.ReactNode;
    permission?: { module: string; action: string };
    children?: NavItem[];
}

const navItems: NavItem[] = [
    {
        id: 'dashboard',
        label: 'Dashboard',
        path: '/dashboard',
        icon: <LayoutDashboard size={20} />,
    },
    {
        id: 'settings',
        label: 'Settings',
        path: '/settings',
        icon: <Settings size={20} />,
        permission: { module: 'SETTINGS', action: 'read' },
        children: [
            { id: 'users', label: 'Users', path: '/settings/users', icon: <Users size={18} /> },
            { id: 'roles', label: 'Roles', path: '/settings/roles', icon: <Shield size={18} /> },
            { id: 'profiles', label: 'Profiles', path: '/settings/profiles', icon: <Key size={18} /> },
            { id: 'groups', label: 'Groups', path: '/settings/groups', icon: <FolderTree size={18} /> },
            { id: 'audit-logs', label: 'Audit Logs', path: '/settings/audit-logs', icon: <FileText size={18} /> },
        ],
    },
];

export function Sidebar() {
    const { user, hasPermission, logout } = useAuth();
    const location = useLocation();
    const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set(['settings']));

    const toggleExpanded = (id: string) => {
        setExpandedItems(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    // Filter nav items based on permissions
    const visibleItems = navItems.filter(item => {
        if (!item.permission) return true;
        return hasPermission(item.permission.module, item.permission.action);
    });

    const handleLogout = async () => {
        await logout();
        window.location.href = '/login';
    };

    return (
        <aside className="sidebar">
            <div className="sidebar-header">
                <div className="sidebar-logo">
                    <Shield size={28} />
                    <span>RBAC</span>
                </div>
            </div>

            <nav className="sidebar-nav">
                {visibleItems.map(item => (
                    <div key={item.id} className="nav-item-wrapper">
                        {item.children ? (
                            <>
                                <button
                                    className={`nav-item nav-item-parent ${location.pathname.startsWith(item.path) ? 'active' : ''}`}
                                    onClick={() => toggleExpanded(item.id)}
                                >
                                    {item.icon}
                                    <span>{item.label}</span>
                                    {expandedItems.has(item.id) ? (
                                        <ChevronDown size={16} className="chevron" />
                                    ) : (
                                        <ChevronRight size={16} className="chevron" />
                                    )}
                                </button>
                                {expandedItems.has(item.id) && (
                                    <div className="nav-children">
                                        {item.children.map(child => (
                                            <NavLink
                                                key={child.id}
                                                to={child.path}
                                                className={({ isActive }) =>
                                                    `nav-item nav-item-child ${isActive ? 'active' : ''}`
                                                }
                                            >
                                                {child.icon}
                                                <span>{child.label}</span>
                                            </NavLink>
                                        ))}
                                    </div>
                                )}
                            </>
                        ) : (
                            <NavLink
                                to={item.path}
                                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                            >
                                {item.icon}
                                <span>{item.label}</span>
                            </NavLink>
                        )}
                    </div>
                ))}
            </nav>

            <div className="sidebar-footer">
                <NavLink to="/settings/profile" className="user-menu">
                    <User size={20} />
                    <div className="user-info">
                        <span className="user-name">{user?.first_name} {user?.last_name}</span>
                        <span className="user-email">{user?.primary_email}</span>
                    </div>
                </NavLink>
                <button className="logout-btn" onClick={handleLogout}>
                    <LogOut size={18} />
                    <span>Logout</span>
                </button>
            </div>
        </aside>
    );
}
