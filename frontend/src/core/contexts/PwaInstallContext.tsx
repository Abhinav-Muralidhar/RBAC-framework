import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { PwaInstallContext, type BeforeInstallPromptEvent } from './pwa-install-context';

type NavigatorWithStandalone = Navigator & {
  standalone?: boolean;
};

function isStandaloneDisplayMode() {
  if (typeof window === 'undefined') {
    return false;
  }

  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as NavigatorWithStandalone).standalone === true
  );
}

export function PwaInstallProvider({ children }: { children: ReactNode }) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState<boolean>(isStandaloneDisplayMode);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setIsStandalone(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const clearInstallPrompt = useCallback(() => {
    setDeferredPrompt(null);
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt || isStandalone) {
      return false;
    }

    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    return choice.outcome === 'accepted';
  }, [deferredPrompt, isStandalone]);

  const value = useMemo(
    () => ({
      deferredPrompt,
      isInstallAvailable: Boolean(deferredPrompt) && !isStandalone,
      isStandalone,
      promptInstall,
      clearInstallPrompt,
    }),
    [clearInstallPrompt, deferredPrompt, isStandalone, promptInstall]
  );

  return <PwaInstallContext.Provider value={value}>{children}</PwaInstallContext.Provider>;
}
