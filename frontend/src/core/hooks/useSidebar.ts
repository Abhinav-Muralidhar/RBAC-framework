/**
 * useSidebar Hook
 * 
 * Sidebar collapse/responsive logic with localStorage persistence.
 */

import { useState, useCallback } from 'react';

export interface UseSidebarReturn {
    isCollapsed: boolean;
    toggle: () => void;
    collapse: () => void;
    expand: () => void;
}

export function useSidebar(): UseSidebarReturn {
    const [isCollapsed, setIsCollapsed] = useState(() => {
        if (typeof window === 'undefined') return true;
        return true;
    });
    const toggle = useCallback(() => {
        setIsCollapsed(prev => !prev);
    }, []);

    const collapse = useCallback(() => {
        setIsCollapsed(true);
    }, []);

    const expand = useCallback(() => {
        setIsCollapsed(false);
    }, []);

    return {
        isCollapsed,
        toggle,
        collapse,
        expand,
    };
}
