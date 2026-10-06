/**
 * Admin Settings Modal
 *
 * Full-screen modal for admin settings management.
 * Opens from sidebar footer, positioned to not overlap sidebar.
 */

import { useEffect, useCallback, Suspense, lazy, type ComponentType, type ReactNode } from 'react';
import { useAdminSettings } from '../../contexts/useAdminSettings';
import { SETTINGS_SECTIONS, type SettingsSection } from '../../../routes/routes';
import { lockBodyScroll } from '../../../shared/lib/bodyScrollLock';
import {
    Users,
    Clock,
    Shield,
    Key,
    FileText,
    Building2,
    Mail,
    Share2,
    UsersRound,
    X,
} from 'lucide-react';
import './AdminSettingsModal.css';

const UsersPage = lazy(() => import('../../../plugins/rbac-settings/pages/UsersPage').then((module) => ({ default: module.UsersPage })));
const SessionsPage = lazy(() => import('../../../plugins/rbac-settings/pages/SessionsPage').then((module) => ({ default: module.SessionsPage })));
const RolesPage = lazy(() => import('../../../plugins/rbac-settings/pages/RolesPage').then((module) => ({ default: module.RolesPage })));
const ProfilesPage = lazy(() => import('../../../plugins/rbac-settings/pages/ProfilesPage').then((module) => ({ default: module.ProfilesPage })));
const GroupsPage = lazy(() => import('../../../plugins/rbac-settings/pages/GroupsPage').then((module) => ({ default: module.GroupsPage })));
const SharingRulesPage = lazy(() => import('../../../plugins/rbac-settings/pages/SharingRules').then((module) => ({ default: module.SharingRules })));
const AuditLogsPage = lazy(() => import('../../../plugins/rbac-settings/pages/AuditLogsPage').then((module) => ({ default: module.AuditLogsPage })));
const SmtpPage = lazy(() => import('../../../plugins/rbac-settings/pages/SmtpPage').then((module) => ({ default: module.SmtpPage })));
const OrganizationPage = lazy(() => import('../../../plugins/rbac-settings/pages/OrganizationsPage').then((module) => ({ default: module.OrganizationPage })));

interface SectionConfig {
    id: SettingsSection;
    label: string;
    icon: ReactNode;
    component: ComponentType;
}

function SectionFallback() {
    return (
        <div className="flex min-h-[16rem] items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-sky-100 border-t-sky-500" />
        </div>
    );
}

const sections: SectionConfig[] = [
    { id: SETTINGS_SECTIONS.ORGANIZATIONS, label: 'Organizations', icon: <Building2 size={18} />, component: OrganizationPage },
    { id: SETTINGS_SECTIONS.USERS, label: 'Users', icon: <Users size={18} />, component: UsersPage },
    { id: SETTINGS_SECTIONS.ROLES, label: 'Roles', icon: <Shield size={18} />, component: RolesPage },
    { id: SETTINGS_SECTIONS.PROFILES, label: 'Profiles', icon: <Key size={18} />, component: ProfilesPage },
    { id: SETTINGS_SECTIONS.GROUPS, label: 'Groups', icon: <UsersRound size={18} />, component: GroupsPage },
    { id: SETTINGS_SECTIONS.SHARING_RULES, label: 'Sharing Rules', icon: <Share2 size={18} />, component: SharingRulesPage },
    { id: SETTINGS_SECTIONS.SESSIONS, label: 'Sessions', icon: <Clock size={18} />, component: SessionsPage },
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
        if (!isOpen) {
            return;
        }

        const cleanup = lockBodyScroll();
        window.addEventListener('keydown', handleKeyDown);

        return () => {
            cleanup();
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, handleKeyDown]);

    if (!isOpen) {
        return null;
    }

    const currentSection = sections.find((s) => s.id === activeSection) || sections[0];
    const CurrentComponent = currentSection.component;

    return (
        <div className="admin-settings-backdrop" onClick={closeSettings}>
            <div
                className="admin-settings-container"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Modal Header */}
                <div className="admin-settings-header">
                    <h2>Admin Settings</h2>
                    <button
                        className="admin-settings-close-btn"
                        onClick={closeSettings}
                        title="Close (Esc)"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Sub-nav Tabs */}
                <div className="admin-settings-tabs">
                    {sections.map((section) => (
                        <button
                            key={section.id}
                            className={`admin-settings-tab ${activeSection === section.id ? 'active' : ''}`}
                            onClick={() => setActiveSection(section.id)}
                        >
                            {section.icon}
                            <span>{section.label}</span>
                        </button>
                    ))}
                </div>

                {/* Content Area */}
                <div className="admin-settings-content">
                    <Suspense fallback={<SectionFallback />}>
                        <CurrentComponent />
                    </Suspense>
                </div>
            </div>
        </div>
    );
}
