import { createContext } from 'react';
import type { SettingsSection } from '../../routes/routes';

export interface AdminSettingsState {
    isOpen: boolean;
    activeSection: SettingsSection;
    openSettings: (section?: SettingsSection) => void;
    closeSettings: () => void;
    setActiveSection: (section: SettingsSection) => void;
}

export const AdminSettingsContext = createContext<AdminSettingsState | null>(null);
