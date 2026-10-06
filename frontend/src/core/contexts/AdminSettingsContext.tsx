/**
 * Admin Settings Context
 * 
 * Global state for the admin settings modal.
 */

import { useState, useCallback, type ReactNode } from 'react';
import type { SettingsSection } from '../../routes/routes';
import { SETTINGS_SECTIONS } from '../../routes/routes';
import { AdminSettingsContext } from './admin-settings-context';

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
