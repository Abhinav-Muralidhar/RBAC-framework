import { useEffect, useState } from 'react';
import { WifiOff, X } from 'lucide-react';

export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(() => !navigator.onLine);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => {
      setIsOffline(true);
      setIsDismissed(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOffline || isDismissed) {
    return null;
  }

  return (
    <div className="fixed inset-x-0 top-0 z-[70] flex justify-center px-3 pt-3">
      <div className="flex w-full max-w-2xl items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-950 shadow-lg shadow-amber-950/10 backdrop-blur">
        <WifiOff className="h-5 w-5 shrink-0 text-amber-700" />
        <div className="min-w-0">
          <p className="text-sm font-semibold">You are offline</p>
          <p className="text-xs text-amber-800">
            "Reconnect to view live data and perform actions"
          </p>
        </div>
        <button
          type="button"
          className="ml-auto inline-flex items-center gap-1 rounded-full border border-amber-200 bg-white/90 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-amber-700 shadow-sm transition hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
          onClick={() => setIsDismissed(true)}
          aria-label="Dismiss offline notification"
          title="Dismiss notification"
        >
          <X className="h-3 w-3" />
          <span className="sr-only sm:not-sr-only">Dismiss</span>
        </button>
      </div>
    </div>
  );
}
