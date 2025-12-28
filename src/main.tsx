import { createRoot } from "react-dom/client";
import App from "./App";
import "./tailwind.css";
import { log } from "./utils/logger";

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

createRoot(document.getElementById("root")!).render(<App />);