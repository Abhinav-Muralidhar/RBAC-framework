/**
 * Dashboard Page
 * Minimal & Classy Overview
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../core/contexts/useAuth';
import { Users, Shield, Key, FolderTree, Clock, ShieldCheck, UserCheck } from 'lucide-react';
import { SETTINGS_SECTIONS, ROUTES } from '../routes/routes';
import { useAdminSettings } from '../core/contexts/useAdminSettings';
import './DashboardPage.css';

export function DashboardPage() {
    const navigate = useNavigate();
    const { user, hasPermission, isLoading } = useAuth();
    const { openSettings } = useAdminSettings();

    useEffect(() => {
        if (!isLoading && !hasPermission('DASHBOARD', 'read')) {
            navigate(ROUTES.UNAUTHORIZED, { replace: true });
        }
    }, [isLoading, hasPermission, navigate]);

    const quickLinks = [
        { section: SETTINGS_SECTIONS.USERS, label: 'Users', description: 'Accounts & access', icon: <Users size={20} />, color: '#0284c7' },
        { section: SETTINGS_SECTIONS.ROLES, label: 'Roles', description: 'Hierarchy & scope', icon: <Shield size={20} />, color: '#6366f1' },
        { section: SETTINGS_SECTIONS.PROFILES, label: 'Profiles', description: 'Module permissions', icon: <Key size={20} />, color: '#10b981' },
        { section: SETTINGS_SECTIONS.GROUPS, label: 'Groups', description: 'Teams & shared roles', icon: <FolderTree size={20} />, color: '#f59e0b' },
    ];

    const groupNames = user?.groups?.map((g: { name: string }) => g.name).join(', ') || 'None';

    return (
        <div className="dashboard-page">
            <header className="dashboard-header">
                <div>
                    <h1 className="dashboard-title">
                        Welcome, {user?.first_name || user?.username}
                    </h1>
                    <p className="dashboard-subtitle">
                        Security controls and account overview
                    </p>
                </div>
            </header>

            {hasPermission('SETTINGS', 'read') && (
                <section className="dashboard-section">
                    <h2 className="dashboard-section-title">Quick Access</h2>
                    <div className="quick-links-grid">
                        {quickLinks.map(link => (
                            <button
                                key={link.section}
                                type="button"
                                className="quick-link-card"
                                style={{ '--accent-color': link.color } as React.CSSProperties}
                                onClick={() => openSettings(link.section)}
                            >
                                <div className="quick-link-icon">{link.icon}</div>
                                <div className="quick-link-info">
                                    <span className="quick-link-title">{link.label}</span>
                                    <span className="quick-link-desc">{link.description}</span>
                                </div>
                            </button>
                        ))}
                    </div>
                </section>
            )}

            <section className="dashboard-section">
                <h2 className="dashboard-section-title">Overview</h2>
                <div className="dashboard-info-grid">
                    <div className="info-card">
                        <div className="info-card-header">
                            <span className="info-card-label">Role</span>
                            <ShieldCheck size={18} className="info-card-icon-muted" />
                        </div>
                        <span className="info-card-value">{user?.rolesname || 'Standard User'}</span>
                    </div>

                    <div className="info-card">
                        <div className="info-card-header">
                            <span className="info-card-label">Groups</span>
                            <UserCheck size={18} className="info-card-icon-muted" />
                        </div>
                        <span className="info-card-value" title={groupNames}>{groupNames}</span>
                    </div>

                    <div className="info-card">
                        <div className="info-card-header">
                            <span className="info-card-label">Last Login</span>
                            <Clock size={18} className="info-card-icon-muted" />
                        </div>
                        <span className="info-card-value">
                            {user?.last_login_at ? new Date(user.last_login_at).toLocaleString() : 'First login'}
                        </span>
                    </div>
                </div>
            </section>
        </div>
    );
}
