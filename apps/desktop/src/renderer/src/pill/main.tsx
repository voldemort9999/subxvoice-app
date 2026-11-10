import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/archivo";
import "@fontsource/dm-mono/400.css";
import "@fontsource-variable/noto-sans-devanagari";
import { Pill } from "./Pill";
import "./pill.css";

const root = document.getElementById("root");
if (!root) throw new Error("#root not found");

createRoot(root).render(
  <StrictMode>
    <Pill />
  </StrictMode>,
);
