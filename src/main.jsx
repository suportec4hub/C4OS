import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

// When a new deploy changes chunk hashes, dynamic imports of old chunks fail.
// Vite fires this event; reloading fetches the fresh manifest and resolves it.
window.addEventListener("vite:preloadError", () => {
  window.location.reload();
});

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
