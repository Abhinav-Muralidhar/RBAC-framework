import { useContext } from 'react';
import { AdminSettingsContext } from './admin-settings-context';

export function useAdminSettings() {
    const context = useContext(AdminSettingsContext);
    if (!context) {
        throw new Error('useAdminSettings must be used within an AdminSettingsProvider');
    }
    return context;
}
