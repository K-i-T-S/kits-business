import * as Sentry from "@sentry/react";
import { createRoot } from 'react-dom/client';

import App from './App';
import './tailwind.css';
import { log } from './utils/logger';

Sentry.init({
  dsn: "https://c72181c8ef7291c6dc07a51c7af3ea6e@o4511584735854592.ingest.de.sentry.io/4511584748699728",
  dataCollection: {
    // To disable sending user data and HTTP bodies, uncomment the lines below. For more info visit:
    // https://docs.sentry.io/platforms/javascript/guides/react/configuration/options/#dataCollection
    // userInfo: false,
    // httpBodies: []
  }
});

// Add this button component to your app to test Sentry's error tracking
function ErrorButton() {
  return (
    <button
      onClick={() => {
        Sentry.captureException(new Error('This is your first error!'));
      }}
      style={{
        position: 'fixed',
        bottom: '12px',
        left: '12px',
        zIndex: 2147483647,
        padding: '12px 20px',
        backgroundColor: '#dc2626',
        color: '#ffffff',
        fontWeight: 700,
        fontSize: '15px',
        border: 'none',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
        cursor: 'pointer',
        pointerEvents: 'auto',
      }}
    >
      💥 Break the world
    </button>
  );
}

// Register service worker for PWA
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js')
    .then((registration) => {
      log.info('SW registered', { registration });
    })
    .catch((registrationError) => {
      const errorObj = registrationError instanceof Error ? registrationError : new Error(String(registrationError));
      log.error('SW registration failed', errorObj);
    });
}

createRoot(document.getElementById('root')!).render(
  <>
    <div style={{ position: 'fixed', top: 12, left: 12, zIndex: 2147483647 }}>
      <ErrorButton />
    </div>
    <App />
  </>
);
