import { test, expect, type Page } from "@playwright/test";
import { mockApi } from "./mockApi";
import { TASKS } from "./fixtures";

// Filtre « Responsable » des listes Projets et Tâches.
//
// La recherche libre trouvait déjà un nom de responsable — ce que le sélecteur
// apporte, c'est de montrer QUI existe et de ne pas dépendre d'une frappe exacte.
// Les tests portent donc sur ce qu'elle ne sait pas faire : filtrer sur une
// personne sans la nommer, et retrouver ce que personne ne porte.

// Tâche 11 → Mathieu (id 2), tâche 12 → Admin (id 1), tâche 13 → sans responsable.
const REPARTIES = TASKS.map((t) =>
  t.id === 11 ? { ...t, responsable_id: 2 } : t.id === 12 ? { ...t, responsable_id: 1 } : t,
);

async function ouvrirTaches(page: Page) {
  await page.setViewportSize({ width: 1400, height: 900 });
  await mockApi(page, { tasks: REPARTIES });
  await page.goto("/tasks");
  await expect(page.getByText("Choix capteurs")).toBeVisible();
}

test("le sélecteur propose l'annuaire, pas seulement les noms déjà présents", async ({ page }) => {
  await ouvrirTaches(page);
  const options = await page.getByLabel("Responsable").locator("option").allTextContents();
  expect(options).toEqual(["Tous", "Sans responsable", "Admin Test", "Mathieu Pourbaix"]);
});

test("choisir une personne ne garde que ses lignes", async ({ page }) => {
  await ouvrirTaches(page);
  await page.getByLabel("Responsable").selectOption({ label: "Mathieu Pourbaix" });
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(page.getByText("Choix capteurs")).toBeVisible();
});

test("« Sans responsable » retrouve ce que personne ne porte", async ({ page }) => {
  await ouvrirTaches(page);
  await page.getByLabel("Responsable").selectOption({ label: "Sans responsable" });
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(page.getByText("Etude debit")).toBeVisible();
});

// Le compteur doit dire « 1 sur 3 », pas « 1 sur 1 » : c'est la raison pour
// laquelle le filtre est appliqué DANS le hook de tri et non par un
// `items.filter()` en amont, qui aurait aussi réduit le total.
test("le compteur garde le total réel", async ({ page }) => {
  await ouvrirTaches(page);
  await expect(page.getByText("3 sur 3")).toBeVisible();
  await page.getByLabel("Responsable").selectOption({ label: "Admin Test" });
  await expect(page.getByText("1 sur 3")).toBeVisible();
});

test("le filtre se cumule avec la recherche", async ({ page }) => {
  await ouvrirTaches(page);
  await page.getByLabel("Responsable").selectOption({ label: "Mathieu Pourbaix" });
  await expect(page.locator("tbody tr")).toHaveCount(1);
  // Une recherche qui ne correspond pas à SA tâche doit vider la liste, et non
  // rouvrir sur les tâches des autres.
  await page.getByLabel("Rechercher une tâche").fill("calibration");
  await expect(page.locator("tbody tr")).toHaveCount(0);
});

test("le filtre existe aussi sur Projets, et sur écran étroit", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await mockApi(page);
  await page.goto("/projects");
  await expect(page.getByText("Capteurs O2")).toBeVisible();
  // C'est là qu'il compte le plus : les filtres par colonne vivent dans
  // l'en-tête du tableau, masqué à cette largeur.
  await expect(page.getByLabel("Responsable")).toBeVisible();
  await expect(page.locator("table.responsive thead")).toBeHidden();
});
