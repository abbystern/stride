import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";

export default defineConfig({
  testDir: "./tests/browser",
  outputDir: "./generated-artifacts/playwright",
  reporter: "list",
  workers: 2,
  timeout: 45_000,
  use: {
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ??
        (existsSync("/repl/tools/bin/chromium") ? "/repl/tools/bin/chromium" : undefined),
    },
    baseURL: process.env.REPLIT_DEV_DOMAIN
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : "http://127.0.0.1:5000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { browserName: "chromium", viewport: { width: 1280, height: 900 } } },
    { name: "mobile", use: { browserName: "chromium", viewport: { width: 390, height: 844 } } },
  ],
});
