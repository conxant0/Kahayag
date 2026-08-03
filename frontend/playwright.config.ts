import { defineConfig } from "@playwright/test";

const PORT = 5173;
// `localhost`, not 127.0.0.1: Vite binds IPv6 loopback by default, so the
// dotted-quad form never answers and the webServer wait times out.
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  use: { baseURL },
  // Boot the dev server for the run unless one is already listening.
  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
