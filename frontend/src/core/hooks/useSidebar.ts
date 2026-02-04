/**
 * useSidebar Hook
 * 
 * Sidebar collapse/responsive logic with localStorage persistence.
 */

import { useState, useEffect, useCallback } from 'react';

const SIDEBAR_COLLAPSED_KEY = 'sidebar-collapsed';
const MOBILE_BREAKPOINT = 768;

export interface UseSidebarReturn {
    isCollapsed: boolean;
    isMobile: boolean;
    toggle: () => void;
    collapse: () => void;
    expand: () => void;
}

export function useSidebar(): UseSidebarReturn {
    const [isCollapsed, setIsCollapsed] = useState(() => {
        const stored = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
        return stored === 'true';
    });
    const [isMobile, setIsMobile] = useState(() =>
        typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT
    );

    // Handle window resize for mobile detection
    useEffect(() => {
        const handleResize = () => {
            const mobile = window.innerWidth < MOBILE_BREAKPOINT;
            setIsMobile(mobile);
            // Auto-collapse on mobile
            if (mobile && !isCollapsed) {
                setIsCollapsed(true);
            }
        };

        window.addEventListener('resize', handleResize);
        // Initial check
        handleResize();

        return () => window.removeEventListener('resize', handleResize);
    }, [isCollapsed]);

    // Persist collapsed state (only for non-mobile)
    useEffect(() => {
        if (!isMobile) {
            localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(isCollapsed));
        }
    }, [isCollapsed, isMobile]);

    const toggle = useCallback(() => {
        setIsCollapsed(prev => !prev);
    }, []);

    const collapse = useCallback(() => {
        setIsCollapsed(true);
    }, []);

    const expand = useCallback(() => {
        setIsCollapsed(false);
    }, []);

    return { isCollapsed, isMobile, toggle, collapse, expand };
}
