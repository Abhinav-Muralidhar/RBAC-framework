import { useState, useEffect } from 'react';

export function useMediaQuery(query: string): boolean {
    const getInitialMatch = () => {
        if (typeof window === 'undefined') {
            return false;
        }
        return window.matchMedia(query).matches;
    };

    const [matches, setMatches] = useState<boolean>(getInitialMatch);

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }

        const mediaQueryList = window.matchMedia(query);
        const handleChange = (event: MediaQueryListEvent) => {
            setMatches(event.matches);
        };

        const supportsEventTargetListeners = (
            list: MediaQueryList
        ): list is MediaQueryList & {
            addEventListener: (type: 'change', listener: (event: MediaQueryListEvent) => void) => void;
            removeEventListener: (type: 'change', listener: (event: MediaQueryListEvent) => void) => void;
        } => typeof list.addEventListener === 'function' && typeof list.removeEventListener === 'function';

        const supportsLegacyListeners = (
            list: MediaQueryList
        ): list is MediaQueryList & {
            addListener: (listener: (event: MediaQueryListEvent) => void) => void;
            removeListener: (listener: (event: MediaQueryListEvent) => void) => void;
        } => typeof list.addListener === 'function' && typeof list.removeListener === 'function';

        let cleanup: (() => void) | undefined;

        if (supportsEventTargetListeners(mediaQueryList)) {
            mediaQueryList.addEventListener('change', handleChange);
            cleanup = () => mediaQueryList.removeEventListener('change', handleChange);
        } else if (supportsLegacyListeners(mediaQueryList)) {
            mediaQueryList.addListener(handleChange);
            cleanup = () => mediaQueryList.removeListener(handleChange);
        }

        return () => {
            cleanup?.();
        };
    }, [query]);

    return matches;
}
