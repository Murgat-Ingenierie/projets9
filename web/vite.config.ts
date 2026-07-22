/// <reference types="vitest/config" />
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
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
