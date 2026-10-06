import { useEffect, useRef, useState } from 'react';
import { RotateCw } from 'lucide-react';

type ServiceWorkerRegistrationEvent = CustomEvent<{
  registration: ServiceWorkerRegistration;
}>;

export function PwaUpdateBanner() {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [visible, setVisible] = useState(false);
  const reloadTimeoutRef = useRef<number | null>(null);
  const reloadRequestedRef = useRef(false);

  const clearReloadTimeout = () => {
    if (reloadTimeoutRef.current !== null) {
      window.clearTimeout(reloadTimeoutRef.current);
      reloadTimeoutRef.current = null;
    }
  };

  const hardResetAndReload = async () => {
    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((item) => item.unregister()));
      }
    } catch {
      // Best effort recovery only.
    }

    try {
      if ('caches' in window) {
        const cacheKeys = await caches.keys();
        await Promise.all(cacheKeys.map((key) => caches.delete(key)));
      }
    } catch {
      // Best effort recovery only.
    }

    window.location.reload();
  };

  useEffect(() => {
    const handleRegistration = (event: Event) => {
      const customEvent = event as ServiceWorkerRegistrationEvent;
      const nextRegistration = customEvent.detail?.registration;
      if (!nextRegistration) {
        return;
      }

      setRegistration(nextRegistration);
      setVisible(Boolean(nextRegistration.waiting));
    };

    const handleUpdateReady = (event: Event) => {
      const customEvent = event as ServiceWorkerRegistrationEvent;
      const nextRegistration = customEvent.detail?.registration;
      if (!nextRegistration) {
        return;
      }

      setRegistration(nextRegistration);
      setVisible(true);
    };

    window.addEventListener('sw-registration', handleRegistration as EventListener);
    window.addEventListener('sw-update-ready', handleUpdateReady as EventListener);

    return () => {
      window.removeEventListener('sw-registration', handleRegistration as EventListener);
      window.removeEventListener('sw-update-ready', handleUpdateReady as EventListener);
    };
  }, []);

  useEffect(() => {
    if (!registration?.waiting) {
      return;
    }

    const handleControllerChange = () => {
      clearReloadTimeout();
      reloadRequestedRef.current = false;
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

    return () => {
      clearReloadTimeout();
      reloadRequestedRef.current = false;
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
    };
  }, [registration]);

  const handleRefresh = async () => {
    if (reloadRequestedRef.current) {
      return;
    }

    reloadRequestedRef.current = true;

    if (registration?.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      clearReloadTimeout();
      reloadTimeoutRef.current = window.setTimeout(() => {
        void hardResetAndReload();
      }, 2500);
      return;
    }

    await hardResetAndReload();
  };

  if (!visible) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-1/2 z-[80] w-[min(92vw,28rem)] -translate-x-1/2 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-xl shadow-slate-900/10">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
          <RotateCw className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">New version available</p>
          <p className="text-xs text-slate-500">Reload to pick up the latest changes.</p>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white"
        >
          Reload
        </button>
      </div>
    </div>
  );
}
