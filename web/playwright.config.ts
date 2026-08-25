import { defineConfig } from "@playwright/test";

// Filet e2e du planning (Phase 0 du plan C9). Les tests pilotent le Gantt réel
// dans un vrai navigateur (Edge système, pas de téléchargement) et mockent l'API
// côté Playwright — pas de backend requis, déterministe, rejouable en CI.
// 8882 et non 5174 : le port par défaut de Vite est disputé par les autres
// projets de la machine, et `reuseExistingServer` (hors CI) fait alors tourner
// la suite contre CE QUI RÉPOND — une autre application. Des tests qui ne
// vérifient qu'une absence de débordement passeraient sans rien prouver.
const PORT = 8882;

// En CI (runners Linux, pas d'Edge) : chromium bundlé (installé par le job CI).
// En local : Edge système par défaut (pas de téléchargement) ; surchargeable via
// PW_CHANNEL (ex. "chrome"). Mettre PW_CHANNEL="" pour forcer chromium en local.
const channel = process.env.CI ? undefined : (process.env.PW_CHANNEL ?? "msedge") || undefined;

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    channel,
    headless: true,
    trace: "on-first-retry",
  },
  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    // L'application EXIGE une configuration OIDC depuis le retrait du mode sans
    // authentification — sans elle, elle affiche « Application mal configurée »
    // au lieu du planning. Autorité fictive, jamais jointe : les tests posent
    // eux-mêmes une session valide dans le stockage (cf. e2e/mockApi.ts) et
    // l'API est mockée. Doit rester aligné avec les constantes de ce fichier-là.
    env: {
      VITE_OIDC_AUTHORITY: "https://auth.e2e.invalid/realms/e2e",
      VITE_OIDC_CLIENT_ID: "projets9-front",
    },
  },
});
