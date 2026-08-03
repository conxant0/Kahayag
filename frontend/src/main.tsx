// Defines the browser entry point.
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./app/App";

import "./shared/styles/index.css";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Missing #root element in index.html");
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
