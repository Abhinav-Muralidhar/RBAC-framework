/**
 * Admin Settings Modal
 *
 * Minimal, classy workspace modal for system administration & RBAC management.
 * Includes smooth transitions, clear categories, and ESC hotkey support.
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
    ChevronRight,
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
    description: string;
    category: 'Access Control' | 'Governance' | 'System';
    icon: ReactNode;
    component: ComponentType;
}

function SectionFallback() {
    return (
        <div className="admin-settings-loading-state">
            <div className="admin-settings-spinner" />
            <span>Loading...</span>
        </div>
    );
}

const sections: SectionConfig[] = [
    {
        id: SETTINGS_SECTIONS.ORGANIZATIONS,
        label: 'Organizations',
        description: 'Organizations and branding',
        category: 'Access Control',
        icon: <Building2 size={18} />,
        component: OrganizationPage
    },
    {
        id: SETTINGS_SECTIONS.USERS,
        label: 'Users',
        description: 'User accounts and credentials',
        category: 'Access Control',
        icon: <Users size={18} />,
        component: UsersPage
    },
    {
        id: SETTINGS_SECTIONS.ROLES,
        label: 'Roles',
        description: 'Security roles and hierarchy',
        category: 'Access Control',
        icon: <Shield size={18} />,
        component: RolesPage
    },
    {
        id: SETTINGS_SECTIONS.PROFILES,
        label: 'Profiles',
        description: 'Module permissions and access profiles',
        category: 'Access Control',
        icon: <Key size={18} />,
        component: ProfilesPage
    },
    {
        id: SETTINGS_SECTIONS.GROUPS,
        label: 'Groups',
        description: 'User groups and shared roles',
        category: 'Access Control',
        icon: <UsersRound size={18} />,
        component: GroupsPage
    },
    {
        id: SETTINGS_SECTIONS.SHARING_RULES,
        label: 'Sharing Rules',
        description: 'Data visibility and sharing policies',
        category: 'Governance',
        icon: <Share2 size={18} />,
        component: SharingRulesPage
    },
    {
        id: SETTINGS_SECTIONS.SESSIONS,
        label: 'Active Sessions',
        description: 'Active sessions and device tracking',
        category: 'Governance',
        icon: <Clock size={18} />,
        component: SessionsPage
    },
    {
        id: SETTINGS_SECTIONS.AUDIT_LOGS,
        label: 'Audit Logs',
        description: 'System audit and security event history',
        category: 'Governance',
        icon: <FileText size={18} />,
        component: AuditLogsPage
    },
    {
        id: SETTINGS_SECTIONS.SMTP,
        label: 'SMTP Config',
        description: 'Outbound email delivery settings',
        category: 'System',
        icon: <Mail size={18} />,
        component: SmtpPage
    },
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

    // Group sections by category
    const categories: Array<'Access Control' | 'Governance' | 'System'> = [
        'Access Control',
        'Governance',
        'System'
    ];

    return (
        <div className="admin-settings-backdrop" onClick={closeSettings}>
            <div
                className="admin-settings-container"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="admin-settings-title"
            >
                {/* Modal Topbar */}
                <div className="admin-settings-header">
                    <div className="admin-settings-header-left">

                        <div className="admin-settings-title-group">
                            <div className="admin-settings-title-row">
                                <h2 id="admin-settings-title">Admin Settings</h2>
                            </div>
                            <p className="admin-settings-subtitle">
                                Complete configuration and management of your application.
                            </p>
                        </div>
                    </div>

                    <div className="admin-settings-header-right">
                        <button
                            className="admin-settings-close-btn"
                            onClick={closeSettings}
                            aria-label="Close admin settings"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Main Workspace (Sidebar Navigation + Dynamic Content) */}
                <div className="admin-settings-body">
                    {/* Left Navigation Rail */}
                    <aside className="admin-settings-sidebar">
                        <div className="admin-settings-nav-scroll">
                            {categories.map((category) => {
                                const items = sections.filter((s) => s.category === category);
                                return (
                                    <div key={category} className="admin-settings-category-group">
                                        <div className="admin-settings-category-title">
                                            {category}
                                        </div>
                                        <div className="admin-settings-category-items">
                                            {items.map((section) => {
                                                const isActive = activeSection === section.id;
                                                return (
                                                    <button
                                                        key={section.id}
                                                        type="button"
                                                        className={`admin-settings-nav-btn ${isActive ? 'active' : ''}`}
                                                        onClick={() => setActiveSection(section.id)}
                                                    >
                                                        <span className="admin-settings-nav-icon">
                                                            {section.icon}
                                                        </span>
                                                        <span className="admin-settings-nav-label">
                                                            {section.label}
                                                        </span>
                                                        <ChevronRight size={14} className="admin-settings-nav-arrow" />
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </aside>

                    {/* Right Content Canvas */}
                    <main className="admin-settings-content">
                        <Suspense fallback={<SectionFallback />}>
                            <CurrentComponent />
                        </Suspense>
                    </main>
                </div>
            </div>
        </div>
    );
}
