import { test, expect, type Page } from "@playwright/test";
import { mockApi, type ApiCall } from "./mockApi";

// Parité SVAR (/planning-svar, C9 Phase 2b). Pilote le nouveau Gantt avec l'API
// mockée ; on assère sur du visible/comportement (portable entre implémentations),
// pas sur le DOM interne de la lib.
//
// Le DESSIN d'un lien dans SVAR = DEUX CLICS sur les poignées de connexion (pas un
// drag) : clic sur la poignée de la tâche source, puis clic sur celle de la cible ;
// le type se déduit des côtés (droite→gauche = FS, gauche→gauche = SS, …). Ce geste
// EST pilotable en headless et couvert ci-dessous.
//
// Restent vérifiés en aperçu live (DnD `mousedown` natif, non pilotable de façon
// stable en headless — géométrie dépendante de la date/largeur des barres) : le
// DÉPLACEMENT d'une barre (incr. 2) et la SUPPRESSION d'un lien (sélection de la
// ligne puis bouton corbeille). La logique reste couverte en unitaire
// (buildSvarLinks/svarLinkToDependency/parseSvarId, src/planning/*.test.ts).

async function gotoSvar(page: Page): Promise<ApiCall[]> {
  // Date figée dans la fenêtre des fixtures (tâches jul.–sep. 2026) + fenêtre large :
  // défilement par défaut de SVAR et géométrie déterministes, indépendants de la date
  // réelle d'exécution (les poignées des tâches 12/13 restent à l'écran).
  await page.clock.setFixedTime(new Date("2026-07-20T08:00:00"));
  await page.setViewportSize({ width: 1600, height: 900 });
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

// Clic sur la poignée de connexion (gauche = début, droite = fin) d'une barre.
async function clickHandle(page: Page, taskId: string, side: "left" | "right") {
  const bar = page.locator(`[data-task-id=":task:${taskId}"]`).first();
  await bar.hover();
  await bar.locator(`.wx-link.wx-${side}`).click({ force: true });
}

const postDep = (calls: ApiCall[]) =>
  calls.find((c) => c.method === "POST" && c.path.endsWith("/api/dependencies"));

test.describe("Planning SVAR — parité 2b", () => {
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

  test("dessiner un lien (2 clics sur les poignées) crée une dépendance (POST)", async ({ page }) => {
    const calls = await gotoSvar(page);
    await expandRow(page, "Capteurs O2"); // tâche 12 « Pose et calibration »
    await expandRow(page, "Regulation flux"); // tâche 13 « Etude debit »
    await expect(page.getByText("Etude debit").first()).toBeVisible();
    // Poignées de début visibles à l'écran (les fins sont hors champ à cellWidth 36) :
    // début(12) → début(13) = SS. Exerce svarLinkToDependency + le handler add-link.
    await clickHandle(page, "12", "left");
    await clickHandle(page, "13", "left");
    await expect.poll(() => postDep(calls), { timeout: 5000 }).toBeTruthy();
    expect(postDep(calls)!.body).toMatchObject({ tache_amont_id: 12, tache_aval_id: 13, type: "SS" });
  });

  test("contrôles : zoom Jour/Semaine/Mois + colonne aujourd'hui", async ({ page }) => {
    await gotoSvar(page);
    const jour = page.getByRole("button", { name: "Jour", exact: true });
    const semaine = page.getByRole("button", { name: "Semaine", exact: true });
    const mois = page.getByRole("button", { name: "Mois", exact: true });
    await expect(jour).toHaveAttribute("aria-pressed", "true"); // Jour actif par défaut
    await expect(semaine).toHaveAttribute("aria-pressed", "false");

    await mois.click();
    await expect(mois).toHaveAttribute("aria-pressed", "true");
    await expect(jour).toHaveAttribute("aria-pressed", "false");

    await expect(page.getByRole("button", { name: /Aujourd'hui/ })).toBeVisible();

    // Colonne « aujourd'hui » surlignée (horloge figée au 2026-07-20, dans la fenêtre).
    await jour.click();
    await expect(page.locator(".wx-today-col").first()).toBeVisible();
  });

  test("filtre équipe : scope + union multi-équipes + réinitialisation", async ({ page }) => {
    await gotoSvar(page);
    const eqA = page.getByRole("button", { name: "Equipe A", exact: true });
    const eqB = page.getByRole("button", { name: "Equipe B", exact: true });
    await expect(page.getByText("Capteurs O2").first()).toBeVisible();
    await expect(page.getByText("Regulation flux").first()).toBeVisible();

    // Equipe A → seule la tâche 11 (projet « Capteurs O2 ») : « Regulation flux » masqué.
    await eqA.click();
    await expect(eqA).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("Capteurs O2").first()).toBeVisible();
    await expect(page.getByText("Regulation flux")).toHaveCount(0);

    // + Equipe B (tâche 13, projet 2) → UNION : « Regulation flux » réapparaît.
    await eqB.click();
    await expect(page.getByText("Regulation flux").first()).toBeVisible();
    await expect(page.getByText("Capteurs O2").first()).toBeVisible();

    // Décocher A → « Capteurs O2 » masqué, « Regulation flux » reste (scope B).
    await eqA.click();
    await expect(eqA).toHaveAttribute("aria-pressed", "false");
    await expect(page.getByText("Capteurs O2")).toHaveCount(0);
    await expect(page.getByText("Regulation flux").first()).toBeVisible();

    // Réinitialiser → tout revient.
    await page.getByRole("button", { name: /Réinitialiser/ }).click();
    await expect(page.getByText("Capteurs O2").first()).toBeVisible();
    await expect(page.getByText("Regulation flux").first()).toBeVisible();
  });

  test("group-by-epic : le toggle masque puis rétablit les lignes d'epic", async ({ page }) => {
    await gotoSvar(page);
    const toggle = page.getByRole("button", { name: /Grouper par epic/ });
    await expect(toggle).toHaveAttribute("aria-pressed", "true"); // groupé par défaut
    await expect(page.getByText("Optimisation bassins").first()).toBeVisible();

    await toggle.click(); // dégrouper
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await expect(page.getByText("Optimisation bassins")).toHaveCount(0); // plus de ligne epic
    await expect(page.getByText("Capteurs O2").first()).toBeVisible(); // projets à la racine

    await toggle.click(); // re-grouper
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("Optimisation bassins").first()).toBeVisible(); // ligne epic rétablie
  });
});
