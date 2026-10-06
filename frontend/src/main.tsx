import { createRoot } from 'react-dom/client'
import App from './App.tsx'

declare const __APP_BUILD_ID__: string;

const renderFatalScreen = (message: string) => {
  const root = document.getElementById('root');
  if (!root) {
    return;
  }

  root.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:linear-gradient(180deg,#f8fafc 0%,#e2e8f0 100%);color:#0f172a;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
      <div style="max-width:560px;width:100%;background:#ffffff;border:1px solid #fecaca;border-radius:24px;padding:32px;box-shadow:0 24px 48px -24px rgba(15,23,42,0.25);">
        <p style="margin:0 0 12px;font-size:12px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#dc2626;">Application Error</p>
        <h1 style="margin:0 0 12px;font-size:28px;line-height:1.2;">This screen failed to start.</h1>
        <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#475569;">${message}</p>
        <button type="button" onclick="window.location.reload()" style="border:0;border-radius:12px;background:#0f172a;color:#ffffff;padding:12px 16px;font-size:14px;font-weight:600;cursor:pointer;">Reload application</button>
      </div>
    </div>
  `;
};

window.addEventListener('error', (event) => {
  if (!document.getElementById('root')?.childElementCount) {
    renderFatalScreen(event.error?.message || 'An unexpected startup error prevented the application from loading.');
  }
});

window.addEventListener('unhandledrejection', (event) => {
  if (!document.getElementById('root')?.childElementCount) {
    const reason = event.reason instanceof Error ? event.reason.message : 'A startup request failed before the app could render.';
    renderFatalScreen(reason);
  }
});

try {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error('The application root element was not found.');
  }

  createRoot(rootElement).render(
    <App />,
  );
} catch (error) {
  renderFatalScreen(error instanceof Error ? error.message : 'The application could not initialize.');
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const serviceWorkerUrl = `/sw.js?build=${encodeURIComponent(__APP_BUILD_ID__)}`;

    void navigator.serviceWorker.register(serviceWorkerUrl).then((registration) => {
      window.dispatchEvent(new CustomEvent('sw-registration', {
        detail: { registration },
      }));

      void registration.update();

      registration.addEventListener('updatefound', () => {
        const nextWorker = registration.installing;
        if (!nextWorker) {
          return;
        }

        nextWorker.addEventListener('statechange', () => {
          if (nextWorker.state === 'installed' && navigator.serviceWorker.controller) {
            window.dispatchEvent(new CustomEvent('sw-update-ready', {
              detail: { registration },
            }));
            window.location.reload();
          }
        });
      });
    }).catch((error) => {
      if (import.meta.env.DEV) {
        console.error('Service worker registration failed', error);
      }
    });
  });
}
