/**
 * Admin Settings Modal
 * 
 * Full-screen modal for admin settings management.
 * Opens from sidebar footer, positioned to not overlap sidebar.
 */

import { useEffect, useCallback } from 'react';
import { useAdminSettings } from '../../contexts/AdminSettingsContext';
import { SETTINGS_SECTIONS, type SettingsSection } from '../../../routes/routes';
import {
    Users,
    Shield,
    Key,
    FolderTree,
    FileText,
    Building2,
    Mail,
    X,
} from 'lucide-react';
import { UsersPage, RolesPage, ProfilesPage, GroupsPage, AuditLogsPage, SmtpPage, OrganizationPage } from '../../../plugins/rbac-settings/pages';
import './AdminSettingsModal.css';

interface SectionConfig {
    id: SettingsSection;
    label: string;
    icon: React.ReactNode;
    component: React.ComponentType;
}

const sections: SectionConfig[] = [
    { id: SETTINGS_SECTIONS.ORGANIZATIONS, label: 'Organizations', icon: <Building2 size={18} />, component: OrganizationPage },
    { id: SETTINGS_SECTIONS.USERS, label: 'Users', icon: <Users size={18} />, component: UsersPage },
    { id: SETTINGS_SECTIONS.ROLES, label: 'Roles', icon: <Shield size={18} />, component: RolesPage },
    { id: SETTINGS_SECTIONS.PROFILES, label: 'Profiles', icon: <Key size={18} />, component: ProfilesPage },
    { id: SETTINGS_SECTIONS.GROUPS, label: 'Groups', icon: <FolderTree size={18} />, component: GroupsPage },
    { id: SETTINGS_SECTIONS.AUDIT_LOGS, label: 'Audit Logs', icon: <FileText size={18} />, component: AuditLogsPage },
    { id: SETTINGS_SECTIONS.SMTP, label: 'SMTP Config', icon: <Mail size={18} />, component: SmtpPage },
];

export function AdminSettingsModal() {
    const { isOpen, activeSection, closeSettings, setActiveSection } = useAdminSettings();

    // Close on ESC key
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            closeSettings();
        }
    }, [closeSettings]);

    useEffect(() => {
        if (isOpen) {
            document.addEventListener('keydown', handleKeyDown);
            document.body.style.overflow = 'hidden';
        }
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = '';
        };
    }, [isOpen, handleKeyDown]);

    if (!isOpen) return null;

    const ActiveComponent = sections.find(s => s.id === activeSection)?.component || UsersPage;

    return (
        <div className="admin-settings-overlay">
            <div className="admin-settings-modal">
                {/* Modal Header */}
                <header className="admin-settings-header">
                    <h2>Admin Settings</h2>
                    <button
                        className="admin-settings-close"
                        onClick={closeSettings}
                        aria-label="Close settings"
                    >
                        <X size={20} />
                    </button>
                </header>

                <div className="admin-settings-body">
                    {/* Settings Sidebar */}
                    <nav className="admin-settings-nav">
                        {sections.map(section => (
                            <button
                                key={section.id}
                                className={`settings-nav-item ${activeSection === section.id ? 'active' : ''}`}
                                onClick={() => setActiveSection(section.id)}
                            >
                                {section.icon}
                                <span>{section.label}</span>
                            </button>
                        ))}
                    </nav>

                    {/* Settings Content */}
                    <div className="admin-settings-content">
                        <ActiveComponent />
                    </div>
                </div>
            </div>
        </div>
    );
}
