import { RouterProvider } from 'react-router-dom';
import { AuthProvider } from './core/contexts/AuthContext';
import { AdminSettingsProvider } from './core/contexts/AdminSettingsContext';
import { ToastProvider } from './core/contexts/ToastContext';
import { AdminSettingsModal } from './core/components/AdminSettingsModal';
import { router } from './router';
import './index.css';

function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <AdminSettingsProvider>
          <RouterProvider router={router} />
          <AdminSettingsModal />
        </AdminSettingsProvider>
      </AuthProvider>
    </ToastProvider>
  );
}

export default App;
