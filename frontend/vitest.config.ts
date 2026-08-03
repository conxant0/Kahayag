import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    // `shared/config/env` throws on import without a scheme-qualified base URL,
    // so tests get one rather than each suite stubbing import.meta.env.
    env: { VITE_API_BASE_URL: "http://localhost:8000/api/v1" },
    // `e2e/` belongs to Playwright; vitest would try to run its test() calls.
    include: ["tests/**/*.{test,spec}.{ts,tsx}"],
  },
});
