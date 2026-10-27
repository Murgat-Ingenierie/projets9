/// <reference types="vitest/config" />
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { policesSvarSansCdn } from "./src/planning/policesSvar";

export default defineConfig({
  // policesSvarSansCdn : polices SVAR sur un CDN refusé par la CSP (#137).
  plugins: [react(), policesSvarSansCdn()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:8080",
    },
  },
  test: {
    // Environnement DOM pour les tests de composants (render/testing-library)
    // et le code qui touche à window/localStorage (client.ts).
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
