import { RouterProvider } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './core/contexts/AuthContext';
import { AdminSettingsProvider } from './core/contexts/AdminSettingsContext';
import { PwaInstallProvider } from './core/contexts/PwaInstallContext';
import { AdminSettingsModal } from './core/components/AdminSettingsModal';
import { BrandingMeta } from './core/components/BrandingMeta';
import { OfflineBanner } from './core/components/OfflineBanner';
import { PwaUpdateBanner } from './core/components/PwaUpdateBanner';
import { ToastProvider } from '@shared/components/feedback/toast';
import { AppErrorBoundary } from '@shared/components/AppErrorBoundary';
import { router } from './router';
import { queryClient } from './core/lib/queryClient';
import './index.css';

function App() {
  return (
    <ToastProvider>
      <OfflineBanner />
      <PwaUpdateBanner />
      <QueryClientProvider client={queryClient}>
        <PwaInstallProvider>
          <AuthProvider>
            <AdminSettingsProvider>
              <AppErrorBoundary>
                <BrandingMeta />
                <RouterProvider router={router} />
                <AdminSettingsModal />
              </AppErrorBoundary>
            </AdminSettingsProvider>
          </AuthProvider>
        </PwaInstallProvider>
      </QueryClientProvider>
    </ToastProvider>
  );
}

export default App;
