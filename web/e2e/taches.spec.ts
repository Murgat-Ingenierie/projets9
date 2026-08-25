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

// Liste de contrôle d'une tâche. Elle vit HORS du formulaire : elle écrit
// immédiatement, là où le formulaire attend « Enregistrer ». Ce que ces tests
// protègent, c'est justement cette séparation — et le fait que la touche Entrée
// dans le champ d'ajout n'enregistre PAS la tâche.
test("la liste de contrôle écrit tout de suite, sans passer par « Enregistrer »", async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  const calls = await mockApi(page);
  await page.goto("/tasks/11/edit");
  await expect(page.getByRole("heading", { name: "À faire" })).toBeVisible();
  // L'API simulée rend une liste vide pour les routes non déclarées.
  await expect(page.getByText("Aucun point pour l'instant.")).toBeVisible();

  await page.getByLabel("Ajouter un point").fill("Visser les boulons");
  await page.getByRole("button", { name: "Ajouter", exact: true }).click();

  const post = () => calls.find((c) => c.method === "POST" && c.path.endsWith("/api/todos"));
  await expect.poll(post, { timeout: 5000 }).toBeTruthy();
  expect(post()!.body).toMatchObject({ tache_id: 11, libelle: "Visser les boulons" });
  // La TÂCHE n'a pas été enregistrée au passage : personne n'a cliqué dessus.
  expect(calls.filter((c) => c.method === "PUT" && c.path.includes("/api/tasks/"))).toHaveLength(0);
});

test("Entrée dans le champ d'ajout n'enregistre pas la tâche", async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  const calls = await mockApi(page);
  await page.goto("/tasks/11/edit");
  await expect(page.getByRole("heading", { name: "À faire" })).toBeVisible();

  await page.getByLabel("Ajouter un point").fill("Purger le circuit");
  await page.getByLabel("Ajouter un point").press("Enter");

  await expect
    .poll(() => calls.find((c) => c.method === "POST" && c.path.endsWith("/api/todos")))
    .toBeTruthy();
  // Le piège que la séparation des deux formulaires évite : à l'intérieur de
  // celui de la tâche, cette touche aurait déclenché son enregistrement.
  expect(calls.filter((c) => c.method === "PUT" && c.path.includes("/api/tasks/"))).toHaveLength(0);
});

test("la création d'une tâche ne montre pas de liste : elle n'a pas encore d'identifiant", async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await mockApi(page);
  await page.goto("/tasks/new");
  await expect(page.getByRole("heading", { name: "Nouvelle tâche" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "À faire" })).toHaveCount(0);
});

// Journal d'activité. Comme la liste de contrôle, il écrit tout de suite et vit
// hors du formulaire. Ce qu'il faut protéger en plus, c'est l'IMMUABILITÉ : rien
// ne doit permettre de rouvrir une entrée publiée.
test("le journal publie tout de suite, et n'offre aucun moyen de modifier", async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  const calls = await mockApi(page);
  await page.goto("/tasks/11/edit");
  await expect(page.getByRole("heading", { name: "Activité" })).toBeVisible();
  await expect(page.getByText("Rien n'a encore été consigné.")).toBeVisible();
  // Prévenu AVANT d'écrire, pas en cherchant un bouton « modifier » inexistant.
  await expect(page.getByText(/ne peut plus être modifiée/)).toBeVisible();

  await page.getByLabel("Nouvelle entrée d'activité").fill("J'ai vissé les boulons");
  await page.getByRole("button", { name: "Publier" }).click();

  const post = () => calls.find((c) => c.method === "POST" && c.path.endsWith("/api/activites"));
  await expect.poll(post, { timeout: 5000 }).toBeTruthy();
  expect(post()!.body).toMatchObject({ tache_id: 11, texte: "J'ai vissé les boulons" });
  // La signature n'est PAS envoyée par le client : l'API la prend du jeton.
  expect(Object.keys(post()!.body as object)).not.toContain("auteur_nom");
  expect(Object.keys(post()!.body as object)).not.toContain("auteur_id");
  // Et la tâche n'a pas été enregistrée au passage.
  expect(calls.filter((c) => c.method === "PUT" && c.path.includes("/api/tasks/"))).toHaveLength(0);
});

// Atteindre une tâche, et son journal, sans savoir où ils se trouvent.
//
// Le journal vit en bas de la page d'une tâche : « Ouvrir » y menait déjà, mais
// il fallait le savoir puis défiler. Et les tâches d'un projet étaient listées
// sur sa page sans aucune issue — on lisait un nom sans pouvoir l'ouvrir.

test("« Activité » ouvre la tâche directement sur son journal", async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 700 });
  await mockApi(page);
  await page.goto("/tasks");
  await expect(page.getByText("Choix capteurs")).toBeVisible();

  await page.locator("tr", { hasText: "Choix capteurs" })
    .getByRole("button", { name: "Activité" }).click();

  // L'ancre est dans l'URL : c'est elle qui distingue ce bouton d'« Ouvrir ».
  await expect(page).toHaveURL(/\/tasks\/11\/edit#activite$/);
  const journal = page.locator("#activite");
  await expect(journal).toBeVisible();
  // Et il est réellement amené à l'écran, pas seulement présent dans la page :
  // sans le défilement, on retomberait en haut du formulaire.
  await expect.poll(async () => journal.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return r.top >= -5 && r.top < window.innerHeight;
  })).toBe(true);
});

test("« Ouvrir » sans ancre ne défile pas jusqu'au journal", async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 700 });
  await mockApi(page);
  await page.goto("/tasks");
  await expect(page.getByText("Choix capteurs")).toBeVisible();

  await page.locator("tr", { hasText: "Choix capteurs" })
    .getByRole("button", { name: "Ouvrir" }).click();
  await expect(page).toHaveURL(/\/tasks\/11\/edit$/);
  // Le contraire du test précédent : la page s'ouvre en haut, sur le formulaire.
  await expect(page.getByRole("heading", { name: /Modifier la tâche/ })).toBeInViewport();
});

test("depuis un projet, on atteint ses tâches", async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await mockApi(page);
  await page.goto("/projects/1/edit");
  await expect(page.getByRole("heading", { name: /Capteurs O2/ })).toBeVisible();

  // Les tâches du projet sont listées ; c'est l'issue qui manquait.
  const ligne = page.locator("tr", { hasText: "Pose et calibration" });
  await expect(ligne).toBeVisible();
  await ligne.getByRole("button", { name: "Ouvrir" }).click();

  await expect(page).toHaveURL(/\/tasks\/12\/edit$/);
  // Le retour ramène au PROJET, pas à la liste générale des tâches : c'est de là
  // qu'on vient.
  await expect(page.locator(".breadcrumb a", { hasText: "Capteurs O2" })).toHaveCount(1);
});
