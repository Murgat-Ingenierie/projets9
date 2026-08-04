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
