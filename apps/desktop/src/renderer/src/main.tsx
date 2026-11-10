import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// Bundled rather than linked: the window works offline and its CSP allows only 'self'.
import "@fontsource-variable/archivo";
import "@fontsource-variable/bricolage-grotesque/opsz.css";
import "@fontsource/dm-mono/400.css";
import "@fontsource/dm-mono/500.css";
import "@fontsource-variable/noto-sans-devanagari";
import { App } from "./App";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("#root not found");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
