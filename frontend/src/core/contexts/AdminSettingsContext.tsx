/**
 * Admin Settings Context
 * 
 * Global state for the admin settings modal.
 */

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { SettingsSection } from '../../routes/routes';
import { SETTINGS_SECTIONS } from '../../routes/routes';

interface AdminSettingsState {
    isOpen: boolean;
    activeSection: SettingsSection;
    openSettings: (section?: SettingsSection) => void;
    closeSettings: () => void;
    setActiveSection: (section: SettingsSection) => void;
}

const AdminSettingsContext = createContext<AdminSettingsState | null>(null);

export function AdminSettingsProvider({ children }: { children: ReactNode }) {
    const [isOpen, setIsOpen] = useState(false);
    const [activeSection, setActiveSection] = useState<SettingsSection>(SETTINGS_SECTIONS.USERS);

    const openSettings = useCallback((section?: SettingsSection) => {
        if (section) {
            setActiveSection(section);
        }
        setIsOpen(true);
    }, []);

    const closeSettings = useCallback(() => {
        setIsOpen(false);
    }, []);

    return (
        <AdminSettingsContext.Provider
            value={{
                isOpen,
                activeSection,
                openSettings,
                closeSettings,
                setActiveSection,
            }}
        >
            {children}
        </AdminSettingsContext.Provider>
    );
}

export function useAdminSettings() {
    const context = useContext(AdminSettingsContext);
    if (!context) {
        throw new Error('useAdminSettings must be used within an AdminSettingsProvider');
    }
    return context;
}
