import { test, expect } from "@playwright/test";
import { mockApi } from "./mockApi";

// Contrat de parité du planning (Gantt actuel, gantt-task-react). Ces tests
// pilotent l'UI avec une API mockée et devront rester VERTS après la bascule
// SVAR (§ plan C9). On assère sur du visible utilisateur, pas sur le DOM interne
// de la lib, pour rester portable entre implémentations.

test.describe("Planning Gantt — contrat de parité", () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page);
    await page.goto("/");
    // auth mockée : on reste sur le planning, pas de redirection vers /login
    await expect(page).not.toHaveURL(/\/login/);
  });

  test("rend la hiérarchie : epic, projets et jalon", async ({ page }) => {
    await expect(page.getByText("O50", { exact: false }).first()).toBeVisible();
    await expect(page.getByText("Capteurs O2").first()).toBeVisible();
    await expect(page.getByText("Regulation flux").first()).toBeVisible();
    await expect(page.getByText("Bassin pilote equipe").first()).toBeVisible();
  });

  test("affiche les contrôles (zoom, groupe par epic, filtre équipe, aujourd'hui)", async ({ page }) => {
    await expect(page.getByText("Jour", { exact: true })).toBeVisible();
    await expect(page.getByText("Semaine", { exact: true })).toBeVisible();
    await expect(page.getByText("Mois", { exact: true })).toBeVisible();
    await expect(page.getByText("Grouper", { exact: false }).first()).toBeVisible();
    await expect(page.getByText("Equipe A").first()).toBeVisible();
    // date du jour dynamique — on vérifie le libellé, pas la valeur
    await expect(page.getByText("Aujourd'hui", { exact: false }).first()).toBeVisible();
  });

  test("déplier un projet révèle ses tâches", async ({ page }) => {
    // tâches masquées tant que le projet est replié
    await expect(page.getByText("Choix capteurs")).toHaveCount(0);
    await page.getByText("Capteurs O2").first().click();
    await expect(page.getByText("Choix capteurs").first()).toBeVisible();
    await expect(page.getByText("Pose et calibration").first()).toBeVisible();
  });
});
