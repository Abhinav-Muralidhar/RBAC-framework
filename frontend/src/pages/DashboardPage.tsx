/**
 * Dashboard Page
 */

import { useAuth } from '../core/contexts/AuthContext';
import { Users, Shield, Key, FolderTree } from 'lucide-react';
import { SETTINGS_SECTIONS } from '../routes/routes';
import { Link } from 'react-router-dom';
import './DashboardPage.css';
import { useAdminSettings } from '../core/contexts/AdminSettingsContext';

export function DashboardPage() {
    const { user, hasPermission } = useAuth();
    const { openSettings } = useAdminSettings();

    const quickLinks = [
        { section: SETTINGS_SECTIONS.USERS, label: 'Manage Users', icon: <Users size={24} />, color: '#3b82f6' },
        { section: SETTINGS_SECTIONS.ROLES, label: 'Manage Roles', icon: <Shield size={24} />, color: '#8b5cf6' },
        { section: SETTINGS_SECTIONS.PROFILES, label: 'Manage Profiles', icon: <Key size={24} />, color: '#10b981' },
        { section: SETTINGS_SECTIONS.GROUPS, label: 'Manage Groups', icon: <FolderTree size={24} />, color: '#f59e0b' },
    ];

    return (
        <div className="dashboard-page">
            <header className="page-header">
                <h1>Welcome back, {user?.first_name || user?.username}!</h1>
            </header>

            {hasPermission('SETTINGS', 'read') && (
                <section className="quick-links">
                    <h2>Quick Actions</h2>
                    <div className="quick-links-grid">
                        {quickLinks.map(link => (
                            <button
                                key={link.section}
                                className="quick-link-card"
                                style={{ '--accent-color': link.color } as React.CSSProperties}
                                onClick={() => openSettings(link.section)} // open modal at section
                            >
                                <div className="quick-link-icon">{link.icon}</div>
                                <span>{link.label}</span>
                            </button>
                        ))}
                    </div>
                </section>
            )}

            <section className="dashboard-info">
                <div className="info-card">
                    <h3>Your Role</h3>
                    <p>{user?.rolesname || 'No role assigned'}</p>
                </div>
                <div className="info-card">
                    <h3>Groups</h3>
                    <p>{user?.groups?.map(g => g.name).join(', ') || 'No group assigned'}</p>
                </div>
                <div className="info-card">
                    <h3>Last Login</h3>
                    <p>{user?.last_login_at ? new Date(user.last_login_at).toLocaleString() : 'First login'}</p>
                </div>
            </section>
        </div>
    );
}
