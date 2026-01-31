/**
 * Dashboard Page
 */

import { useAuth } from '../core/contexts/AuthContext';
import { Users, Shield, Key, FolderTree } from 'lucide-react';
import { Link } from 'react-router-dom';
import './DashboardPage.css';

export function DashboardPage() {
    const { user, hasPermission } = useAuth();

    const quickLinks = [
        { to: '/settings/users', label: 'Manage Users', icon: <Users size={24} />, color: '#3b82f6' },
        { to: '/settings/roles', label: 'Manage Roles', icon: <Shield size={24} />, color: '#8b5cf6' },
        { to: '/settings/profiles', label: 'Manage Profiles', icon: <Key size={24} />, color: '#10b981' },
        { to: '/settings/groups', label: 'Manage Groups', icon: <FolderTree size={24} />, color: '#f59e0b' },
    ];

    return (
        <div className="dashboard-page">
            <header className="page-header">
                <h1>Welcome back, {user?.first_name || user?.username}!</h1>
                <p>Here's an overview of your RBAC system.</p>
            </header>

            {hasPermission('SETTINGS', 'read') && (
                <section className="quick-links">
                    <h2>Quick Actions</h2>
                    <div className="quick-links-grid">
                        {quickLinks.map(link => (
                            <Link key={link.to} to={link.to} className="quick-link-card" style={{ '--accent-color': link.color } as React.CSSProperties}>
                                <div className="quick-link-icon">{link.icon}</div>
                                <span>{link.label}</span>
                            </Link>
                        ))}
                    </div>
                </section>
            )}

            <section className="dashboard-info">
                <div className="info-card">
                    <h3>Your Role</h3>
                    <p>{user?.roles?.[0]?.name || 'No role assigned'}</p>
                </div>
                <div className="info-card">
                    <h3>Groups</h3>
                    <p>{user?.groups?.length || 0} group(s)</p>
                </div>
                <div className="info-card">
                    <h3>Last Login</h3>
                    <p>{user?.last_login_at ? new Date(user.last_login_at).toLocaleString() : 'First login'}</p>
                </div>
            </section>
        </div>
    );
}
