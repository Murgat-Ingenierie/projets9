import { test, expect, type Page } from "@playwright/test";
import { mockApi, type ApiCall } from "./mockApi";

// Parité SVAR (/planning-svar, C9 Phase 2b). Pilote le nouveau Gantt avec l'API
// mockée ; on assère sur du visible/comportement (portable entre implémentations),
// pas sur le DOM interne de la lib.
//
// NB drag/lien : le déplacement d'une barre et la création/suppression d'un lien
// passent par le DnD `mousedown` natif de SVAR, non pilotable de façon STABLE en
// headless (géométrie dépendante de « aujourd'hui » et de la largeur des barres).
// Ces gestes sont vérifiés en aperçu live. La LOGIQUE reste couverte par les tests
// unitaires (dates/cascade côté drag ; buildSvarLinks + svarLinkToDependency +
// parseSvarId côté liens) : cf. src/planning/*.test.ts.

async function gotoSvar(page: Page): Promise<ApiCall[]> {
  const calls = await mockApi(page);
  await page.goto("/planning-svar");
  await expect(page.getByRole("heading", { name: /Planning \(SVAR\)/ })).toBeVisible();
  return calls;
}

// Déplie une ligne (epic/projet) via son chevron de grille pour révéler ses enfants.
async function expandRow(page: Page, name: string) {
  const row = page.locator('[class*="wx-row"]', { hasText: name }).first();
  await row.locator(".wx-toggle-icon").first().click();
}

test.describe("Planning SVAR — parité 2b (lecture)", () => {
  test("rend la hiérarchie : epic, projets, jalon", async ({ page }) => {
    await gotoSvar(page);
    await expect(page.getByText("Optimisation bassins").first()).toBeVisible();
    await expect(page.getByText("Capteurs O2").first()).toBeVisible();
    await expect(page.getByText("Regulation flux").first()).toBeVisible();
    await expect(page.getByText("Bassin pilote equipe").first()).toBeVisible();
  });

  test("déplier un projet révèle ses tâches", async ({ page }) => {
    await gotoSvar(page);
    await expect(page.getByText("Choix capteurs")).toHaveCount(0);
    await expandRow(page, "Capteurs O2");
    await expect(page.getByText("Choix capteurs").first()).toBeVisible();
    await expect(page.getByText("Pose et calibration").first()).toBeVisible();
  });
});
