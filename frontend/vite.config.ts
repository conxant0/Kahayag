import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  // Fail the build rather than ship a bundle that fetches from the frontend origin.
  // Vercel env vars marked Sensitive cannot be decrypted by vercel pull and arrive as "[SENSITIVE]".
  const { VITE_API_BASE_URL } = loadEnv(mode, process.cwd(), "VITE_");
  if (mode === "production" && !/^https?:\/\//.test(VITE_API_BASE_URL ?? "")) {
    throw new Error(`Invalid VITE_API_BASE_URL: ${VITE_API_BASE_URL}`);
  }

  return { plugins: [react(), tailwindcss()] };
});
