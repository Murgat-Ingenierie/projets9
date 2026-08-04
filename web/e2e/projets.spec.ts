import { test, expect } from "@playwright/test";
import { mockApi, type ApiCall } from "./mockApi";

// L'édition inline de la liste des projets. Le point sensible n'est pas qu'elle
// enregistre — c'est CE QU'ELLE ENVOIE : le brouillon est une copie de la ligne,
// et il porte `description`, que cette table n'affiche pas. La route applique
// tout champ fourni, y compris à `null` : envoyer le brouillon entier effacerait
// une description que seule la page de détail montre.

test("l'édition inline n'envoie que les champs de la ligne", async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 700 });
  const calls: ApiCall[] = await mockApi(page);
  await page.goto("/projects");
  await expect(page.getByRole("heading", { name: "Projets" })).toBeVisible();

  await page.locator("tr").filter({ hasText: "Capteurs O2" }).first()
    .getByRole("button", { name: "Éditer" }).click();
  await page.locator("tr.editing input").first().fill("Capteurs O2 (revu)");
  await page.getByRole("button", { name: "Enregistrer" }).click();

  await expect
    .poll(() => calls.find((c) => c.method === "PUT" && c.path.includes("/api/projects/")))
    .toBeTruthy();
  const corps = calls.find((c) => c.method === "PUT" && c.path.includes("/api/projects/"))!
    .body as Record<string, unknown>;

  expect(corps.nom).toBe("Capteurs O2 (revu)");
  // Le champ absent est tout l'objet du test : sa présence, même à null,
  // effacerait la description côté serveur.
  expect(Object.keys(corps)).not.toContain("description");
  // Les métadonnées non plus — elles ne veulent rien dire dans une mise à jour.
  expect(Object.keys(corps)).not.toContain("created_at");
  expect(Object.keys(corps)).not.toContain("id");
});

test("annuler ne persiste rien", async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 700 });
  const calls: ApiCall[] = await mockApi(page);
  await page.goto("/projects");
  await expect(page.getByRole("heading", { name: "Projets" })).toBeVisible();

  await page.locator("tr").filter({ hasText: "Capteurs O2" }).first()
    .getByRole("button", { name: "Éditer" }).click();
  await page.locator("tr.editing input").first().fill("Jamais enregistré");
  await page.getByRole("button", { name: "Annuler" }).click();

  await expect(page.locator("tr.editing")).toHaveCount(0);
  expect(calls.filter((c) => c.method === "PUT")).toHaveLength(0);
});

// Le formulaire de CRÉATION, lui, partait avec un epic vide tout en en affichant
// un : `value=""` ne correspondait à aucune option (le champ étant requis, aucune
// option vide n'était rendue), alors le navigateur montrait la première de la
// liste. L'utilisateur croyait avoir choisi ; l'API refusait la création avec
// « String should have at least 3 characters », incompréhensible depuis l'écran.
test("créer un projet sans choisir d'epic : rien n'est envoyé, le champ est signalé", async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  const calls: ApiCall[] = await mockApi(page);
  await page.goto("/projects/new");
  await expect(page.getByRole("heading", { name: "Nouveau projet" })).toBeVisible();

  const epic = page.locator("select").first();
  // Ce que l'écran montre correspond à l'état : rien de choisi.
  await expect(epic).toHaveValue("");

  // Position et non libellé : les `<label>` du formulaire ne portent pas de
  // `htmlFor`, donc `getByLabel` ne les relie pas à leur champ.
  await page.locator("form.form input").first().fill("Reussir a mettre des alevins en RAS");
  // TOUT le reste est rempli : l'epic doit être le SEUL champ invalide, sans quoi
  // l'absence de POST ne prouverait rien (des dates vides suffiraient à retenir le
  // formulaire, et le test passerait même avec le défaut).
  await page.locator('form.form input[type="date"]').first().fill("2026-08-04");
  await page.locator('form.form input[type="date"]').last().fill("2026-12-12");
  await page.getByRole("button", { name: "Créer" }).click();

  // La validation native retient la soumission : aucun POST, donc aucun 422.
  await expect
    .poll(() => calls.filter((c) => c.method === "POST" && c.path.endsWith("/api/projects")).length)
    .toBe(0);
  expect(await epic.evaluate((el: HTMLSelectElement) => el.checkValidity())).toBe(false);
});

test("créer un projet avec un epic choisi : le trigramme part bien", async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  const calls: ApiCall[] = await mockApi(page);
  await page.goto("/projects/new");
  await expect(page.getByRole("heading", { name: "Nouveau projet" })).toBeVisible();

  await page.locator("select").first().selectOption("O50");
  // Position et non libellé : les `<label>` du formulaire ne portent pas de
  // `htmlFor`, donc `getByLabel` ne les relie pas à leur champ.
  await page.locator("form.form input").first().fill("Reussir a mettre des alevins en RAS");
  // Les dates sont requises elles aussi : sans elles, le formulaire ne partirait
  // pas, et le test dirait « pas de POST » pour la mauvaise raison.
  await page.locator('form.form input[type="date"]').first().fill("2026-08-04");
  await page.locator('form.form input[type="date"]').last().fill("2026-12-12");
  await page.getByRole("button", { name: "Créer" }).click();

  await expect
    .poll(() => calls.find((c) => c.method === "POST" && c.path.endsWith("/api/projects")))
    .toBeTruthy();
  const corps = calls.find((c) => c.method === "POST" && c.path.endsWith("/api/projects"))!
    .body as Record<string, unknown>;
  expect(corps.epic_trigramme).toBe("O50");
});
