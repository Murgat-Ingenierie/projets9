import { test, expect } from "@playwright/test";
import { mockApi, type ApiCall } from "./mockApi";

// Rattacher une équipe à la CRÉATION d'une tâche. Deux écritures : la tâche, puis
// l'allocation — qui a besoin de l'identifiant rendu par la première. Ce que ces
// tests protègent, c'est l'ORDRE et le corps de ces appels, pas l'affichage.

async function nouvelleTache(page: import("@playwright/test").Page): Promise<ApiCall[]> {
  await page.setViewportSize({ width: 1400, height: 900 });
  const calls = await mockApi(page);
  await page.goto("/tasks/new");
  await expect(page.getByRole("heading", { name: "Nouvelle tâche" })).toBeVisible();
  await page.getByLabel("Projet").selectOption("1");
  await page.getByLabel("Nom").fill("Visser les boulons");
  return calls;
}

const poste = (calls: ApiCall[], chemin: string) =>
  calls.find((c) => c.method === "POST" && c.path.endsWith(chemin));

test("sans équipe : une seule écriture, la tâche", async ({ page }) => {
  const calls = await nouvelleTache(page);
  await page.getByRole("button", { name: "Créer" }).click();

  await expect.poll(() => poste(calls, "/api/tasks")).toBeTruthy();
  // L'allocation ne doit PAS partir : personne n'a demandé d'équipe.
  expect(poste(calls, "/api/tache-equipe")).toBeUndefined();
});

test("avec équipe : la tâche puis l'allocation, qui reprend son identifiant", async ({ page }) => {
  const calls = await nouvelleTache(page);
  await page.getByLabel(/Équipe/).selectOption("1");
  await page.getByLabel("Heures allouées").fill("6");
  await page.getByRole("button", { name: "Créer" }).click();

  await expect.poll(() => poste(calls, "/api/tache-equipe"), { timeout: 5000 }).toBeTruthy();
  // 999 = l'identifiant que l'API simulée rend à la création. Le vérifier prouve
  // que l'allocation attend la tâche au lieu d'inventer une référence.
  expect(poste(calls, "/api/tache-equipe")!.body)
    .toMatchObject({ tache_id: 999, equipe_id: 1, heures_allouees: 6 });
  // Et dans cet ordre : l'inverse serait refusé par INV-EQ-5 (tâche inconnue).
  const iTache = calls.findIndex((c) => c.method === "POST" && c.path.endsWith("/api/tasks"));
  const iAlloc = calls.findIndex((c) => c.method === "POST" && c.path.endsWith("/api/tache-equipe"));
  expect(iTache).toBeLessThan(iAlloc);
});

test("équipe choisie mais heures vides : rien n'est envoyé", async ({ page }) => {
  const calls = await nouvelleTache(page);
  await page.getByLabel(/Équipe/).selectOption("1");
  await page.getByRole("button", { name: "Créer" }).click();

  // La validation native retient TOUT le formulaire : pas même la tâche ne part.
  // C'est voulu — une tâche créée sans son allocation laisserait un état à moitié
  // fait qu'un membre ne peut pas défaire, la suppression étant réservée aux admins.
  await expect
    .poll(() => calls.filter((c) => c.method === "POST").length)
    .toBe(0);
  expect(await page.getByLabel("Heures allouées")
    .evaluate((el: HTMLInputElement) => el.checkValidity())).toBe(false);
});
