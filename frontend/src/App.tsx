import { RouterProvider } from 'react-router-dom';
import { AuthProvider } from './core/contexts/AuthContext';
import { AdminSettingsProvider } from './core/contexts/AdminSettingsContext';
import { AdminSettingsModal } from './core/components/AdminSettingsModal';
import { router } from './router';
import './index.css';

function App() {
  return (
    <AuthProvider>
      <AdminSettingsProvider>
        <RouterProvider router={router} />
        <AdminSettingsModal />
      </AdminSettingsProvider>
    </AuthProvider>
  );
}

export default App;
