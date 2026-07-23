import { test, expect, type Page } from "@playwright/test";
import { mockApi, type ApiCall } from "./mockApi";

// Contrat de parité du planning (Gantt actuel, gantt-task-react). Ces tests
// pilotent l'UI avec une API mockée et devront rester VERTS après la bascule
// SVAR (§ plan C9). On assère sur du visible utilisateur / du comportement, pas
// sur le DOM interne de la lib, pour rester portable entre implémentations.

async function gotoPlanning(page: Page): Promise<ApiCall[]> {
  const calls = await mockApi(page);
  await page.goto("/");
  // auth mockée : on reste sur le planning, pas de redirection vers /login
  await expect(page).not.toHaveURL(/\/login/);
  return calls;
}

test.describe("Planning Gantt — contrat de parité", () => {
  test("rend la hiérarchie : epic, projets, jalon", async ({ page }) => {
    await gotoPlanning(page);
    await expect(page.getByText("O50", { exact: false }).first()).toBeVisible();
    await expect(page.getByText("Capteurs O2").first()).toBeVisible();
    await expect(page.getByText("Regulation flux").first()).toBeVisible();
    await expect(page.getByText("Bassin pilote equipe").first()).toBeVisible();
  });

  test("affiche les contrôles (zoom, groupe, filtre équipe, aujourd'hui)", async ({ page }) => {
    await gotoPlanning(page);
    await expect(page.getByRole("button", { name: "Jour", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Semaine", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Mois", exact: true })).toBeVisible();
    await expect(page.getByText("Grouper", { exact: false }).first()).toBeVisible();
    await expect(page.getByText("Equipe A").first()).toBeVisible();
    await expect(page.getByText("Aujourd'hui", { exact: false }).first()).toBeVisible();
  });

  test("déplier puis replier un projet montre/masque ses tâches", async ({ page }) => {
    await gotoPlanning(page);
    await expect(page.getByText("Choix capteurs")).toHaveCount(0);
    await page.getByText("Capteurs O2").first().click();
    await expect(page.getByText("Choix capteurs").first()).toBeVisible();
    await expect(page.getByText("Pose et calibration").first()).toBeVisible();
    await page.getByText("Capteurs O2").first().click(); // replier
    await expect(page.getByText("Choix capteurs")).toHaveCount(0);
  });

  test("le zoom Jour/Semaine/Mois bascule l'échelle active", async ({ page }) => {
    await gotoPlanning(page);
    const mois = page.getByRole("button", { name: "Mois", exact: true });
    const jour = page.getByRole("button", { name: "Jour", exact: true });
    await expect(mois).toHaveClass(/active/); // Mois actif par défaut
    await expect(jour).not.toHaveClass(/active/);
    await jour.click();
    await expect(jour).toHaveClass(/active/);
    await expect(mois).not.toHaveClass(/active/);
    await expect(page.getByText("Capteurs O2").first()).toBeVisible(); // rendu intact
  });

  test("« Grouper par epic » est un toggle (inactif par défaut)", async ({ page }) => {
    await gotoPlanning(page);
    const grouper = page.getByRole("button", { name: /Grouper par epic/ });
    await expect(grouper).not.toHaveClass(/active/);
    await grouper.click();
    await expect(grouper).toHaveClass(/active/);
  });

  test("« Annuler » est désactivé tant qu'il n'y a rien à annuler", async ({ page }) => {
    await gotoPlanning(page);
    await expect(page.getByRole("button", { name: /Annuler/ })).toBeDisabled();
  });

  test("filtrer par équipe masque les projets sans tâche de l'équipe", async ({ page }) => {
    await gotoPlanning(page);
    await expect(page.getByText("Capteurs O2").first()).toBeVisible();
    await expect(page.getByText("Regulation flux").first()).toBeVisible();
    // Equipe A n'a que la tâche 11 (projet « Capteurs O2 ») → « Regulation flux » disparaît
    await page.getByRole("button", { name: "Equipe A", exact: true }).click();
    await expect(page.getByText("Capteurs O2").first()).toBeVisible();
    await expect(page.getByText("Regulation flux")).toHaveCount(0);
  });

  test("éditer un projet ouvre le panneau ; « Fermer » le referme", async ({ page }) => {
    await gotoPlanning(page);
    await page.getByTitle("Éditer le projet").first().click();
    const panel = page.locator("aside.panel");
    await expect(panel).toBeVisible();
    await panel.getByTitle("Fermer").click();
    await expect(panel).toHaveCount(0);
  });

  test("Ctrl+clic sur une tâche la sélectionne (décalage groupé)", async ({ page }) => {
    await gotoPlanning(page);
    await page.getByText("Capteurs O2").first().click(); // déplier
    await page.getByText("Choix capteurs").first().click({ modifiers: ["Control"] });
    await expect(page.getByText(/tâche.*sélectionnée/)).toBeVisible();
  });

  test("charge les 7 collections de données au montage (sans backend)", async ({ page }) => {
    const calls = await gotoPlanning(page);
    for (const p of ["/api/epics", "/api/projects", "/api/tasks", "/api/dependencies", "/api/milestones", "/api/equipes", "/api/tache-equipe"]) {
      await expect.poll(() => calls.some((c) => c.method === "GET" && c.path.endsWith(p))).toBeTruthy();
    }
  });

  test("glisser une barre en mode Édition déclenche une mutation de date (API)", async ({ page }) => {
    const calls = await gotoPlanning(page);
    // le drag/resize n'est actif qu'en mode Édition (cf. libellé du bouton)
    await page.getByRole("button", { name: /Édition/ }).click();

    // la barre du projet vit dans le chart SVG (le libellé de gauche est en HTML)
    const bar = page.locator("svg").getByText("Capteurs O2", { exact: true }).first();
    await expect(bar).toBeVisible();
    const box = await bar.boundingBox();
    if (!box) throw new Error("barre « Capteurs O2 » introuvable dans le chart");
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;

    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 120, cy, { steps: 12 });
    await page.mouse.move(cx + 130, cy, { steps: 4 });
    await page.mouse.up();

    // une mutation de date part vers l'API (projet déplacé, +/- cascade sur tâches)
    await expect
      .poll(() => calls.some((c) => c.method === "PUT" && /\/api\/(projects|tasks)\/\d+/.test(c.path)), { timeout: 8000 })
      .toBeTruthy();
  });
});
