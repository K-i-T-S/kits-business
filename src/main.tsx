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
        throw new Error('This is your first error!');
      }}
    >
      Break the world
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
    <div style={{ position: 'fixed', bottom: 16, right: 16, zIndex: 9999 }}>
      <ErrorButton />
    </div>
    <App />
  </>
);
