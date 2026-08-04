import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { configDefaults } from "vitest/config";
import { CCBPVitestReporter } from "ccbp-jest-reporter/lib/vitestReporter";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: "0.0.0.0",
    allowedHosts: true,
  },
  build: {
    outDir: "build",
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "src/setupTests.js",
    include: ["**/*.test.{js,ts,jsx,tsx}"],
    exclude: [...configDefaults.exclude],
    reporters: [new CCBPVitestReporter()],
  },
});
