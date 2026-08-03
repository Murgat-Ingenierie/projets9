import { test, expect, type Page } from "@playwright/test";
import { mockApi, type ApiCall } from "./mockApi";

// Parité SVAR — planning principal (route `/`) depuis la bascule C9. Pilote le Gantt avec l'API
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
// DÉPLACEMENT d'une barre (incr. 2), le DÉPLACEMENT d'un PROJET (summary → décalage
// en bloc du projet + ses tâches, UN seul undo, cf. planBlockShift) et la SUPPRESSION
// d'un lien (sélection de la ligne puis bouton corbeille). La logique reste couverte
// en unitaire (buildSvarLinks/svarLinkToDependency/parseSvarId/planBlockShift,
// src/planning/*.test.ts).

/** Ouvre le planning.
 *
 *  `vue` fixe le niveau de zoom quand le test dépend de la GÉOMÉTRIE des barres
 *  (double-clic sur une barre, clic sur une poignée de connexion). L'application
 *  ouvre en vue Mois, où une tâche de dix jours occupe une trentaine de pixels :
 *  les poignées s'y chevauchent et le geste devient indéterministe. Un test sur
 *  la géométrie doit donc la fixer, plutôt que d'hériter d'un défaut qui peut
 *  changer — ce qui vient d'arriver.
 *
 *  Sans `vue`, on garde le défaut de l'application : c'est ce que vérifie le test
 *  des contrôles de zoom.
 */
async function gotoSvar(page: Page, vue?: "Jour" | "Semaine" | "Mois"): Promise<ApiCall[]> {
  // Date figée dans la fenêtre des fixtures (tâches jul.–sep. 2026) + fenêtre large :
  // défilement par défaut de SVAR et géométrie déterministes, indépendants de la date
  // réelle d'exécution (les poignées des tâches 12/13 restent à l'écran).
  await page.clock.setFixedTime(new Date("2026-07-20T08:00:00"));
  await page.setViewportSize({ width: 1600, height: 900 });
  const calls = await mockApi(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Planning" })).toBeVisible();
  // Le titre s'affiche avant que SVAR ait dessiné quoi que ce soit. Attendre une
  // BARRE, pas un intitulé : la vue Mois met plus longtemps à se stabiliser que
  // l'ancienne vue Jour, et un geste lancé trop tôt tombe dans le vide — ce qui se
  // manifeste, plus loin, par un panneau qui ne s'ouvre pas.
  await expect(page.locator('[data-task-id^=":proj:"]').first()).toBeVisible();
  if (vue) {
    await page.getByRole("button", { name: vue, exact: true }).click();
    await expect(page.getByRole("button", { name: vue, exact: true }))
      .toHaveAttribute("aria-pressed", "true");
    // Pas d'attente globale ici : elle serait satisfaite par une barre RESTÉE de
    // la vue précédente, donc trompeuse. C'est chaque geste qui attend la cible
    // dont il a besoin (cf. `clickHandle`).
  }
  return calls;
}

// Déplie une ligne (epic/projet) via son chevron de grille pour révéler ses enfants.
async function expandRow(page: Page, name: string) {
  const row = page.locator('[class*="wx-row"]', { hasText: name }).first();
  await row.locator(".wx-toggle-icon").first().click();
}

// Clic sur la poignée de connexion (gauche = début, droite = fin) d'une barre.
//
// L'attente explicite sur la BARRE est indispensable depuis que l'application
// ouvre en vue Mois : ces tests changent de zoom, et SVAR reconstruit alors ses
// barres. Le `force: true` — nécessaire parce que la poignée n'apparaît qu'au
// survol — court-circuite les vérifications d'actionnabilité de Playwright : sans
// cette attente, un clic sur une poignée pas encore rendue « réussit » sans rien
// déclencher, et le test échoue plus loin sur une cause qui n'est plus visible.
async function clickHandle(page: Page, taskId: string, side: "left" | "right") {
  const bar = page.locator(`[data-task-id=":task:${taskId}"]`).first();
  await expect(bar).toBeVisible();
  await bar.hover();
  const poignee = bar.locator(`.wx-link.wx-${side}`);
  await expect(poignee).toBeAttached();
  await poignee.click({ force: true });
}

const postDep = (calls: ApiCall[]) =>
  calls.find((c) => c.method === "POST" && c.path.endsWith("/api/dependencies"));

test.describe("Planning SVAR — parité 2b", () => {
  test("les requêtes portent le jeton de la session Keycloak", async ({ page }) => {
    // Depuis le retrait du mode sans authentification, c'est le SEUL chemin :
    // l'application obtient un jeton de la session OIDC et l'attache à chaque
    // requête. Sans ce test, les autres passeraient identiquement avec un front
    // qui n'authentifie rien — l'API est mockée et répond à tout le monde.
    const calls = await gotoSvar(page);
    expect(calls.length).toBeGreaterThan(0);
    for (const c of calls) expect(c.auth).toBe("Bearer jeton-e2e");
  });

  test("rend les projets et jalons (à plat par défaut)", async ({ page }) => {
    await gotoSvar(page);
    await expect(page.getByText("Capteurs O2").first()).toBeVisible();
    await expect(page.getByText("Regulation flux").first()).toBeVisible();
    await expect(page.getByText("Bassin pilote equipe").first()).toBeVisible();
    await expect(page.getByText("Optimisation bassins")).toHaveCount(0); // pas de ligne epic par défaut
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
    await expect(mois).toHaveAttribute("aria-pressed", "true"); // Mois actif par défaut
    await expect(jour).toHaveAttribute("aria-pressed", "false");

    await semaine.click();
    await expect(semaine).toHaveAttribute("aria-pressed", "true");
    await expect(mois).toHaveAttribute("aria-pressed", "false");

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

  test("group-by-epic : le toggle ajoute puis retire les lignes d'epic", async ({ page }) => {
    await gotoSvar(page);
    const toggle = page.getByRole("button", { name: /Grouper par epic/ });
    await expect(toggle).toHaveAttribute("aria-pressed", "false"); // à plat par défaut
    await expect(page.getByText("Optimisation bassins")).toHaveCount(0); // pas de ligne epic
    await expect(page.getByText("Capteurs O2").first()).toBeVisible();

    await toggle.click(); // grouper
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("Optimisation bassins").first()).toBeVisible(); // ligne epic ajoutée

    await toggle.click(); // dégrouper
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await expect(page.getByText("Optimisation bassins")).toHaveCount(0);
  });

  test("l'état déplié d'un projet survit à un toggle groupe/filtre (réactivité)", async ({ page }) => {
    await gotoSvar(page);
    await expandRow(page, "Capteurs O2");
    await expect(page.getByText("Choix capteurs").first()).toBeVisible();

    // Basculer le groupe reconstruit l'arbre mais NE doit PAS replier le projet.
    await page.getByRole("button", { name: /Grouper par epic/ }).click();
    await expect(page.getByText("Choix capteurs").first()).toBeVisible();

    // Un filtre équipe qui garde le projet visible ne le replie pas non plus.
    await page.getByRole("button", { name: "Equipe A", exact: true }).click();
    await expect(page.getByText("Choix capteurs").first()).toBeVisible();
  });

  // Repris du contrat de parité de l'ancien Gantt (e2e/gantt.spec.ts, retiré à la
  // bascule) : l'édition depuis le planning passe par EditPanel, pas par l'éditeur
  // natif de SVAR (qui est intercepté).
  test("double-cliquer une ligne ouvre EditPanel ; « Fermer » le referme", async ({ page }) => {
    await gotoSvar(page);
    const barre = page.locator('[data-task-id=":proj:1"]').first();
    await expect(barre).toBeVisible();
    await barre.dblclick();
    const panel = page.locator("aside.panel");
    // Attendre le bouton lui-même avant de cliquer. Le panneau s'ouvre d'abord
    // sur « Chargement… » puis se re-rend avec ses données : `click()` seul peut
    // viser un élément en cours de remplacement. Viser le BOUTON — présent dans
    // les deux états — plutôt que l'en-tête chargé, qui dépend d'une requête et
    // rendait le test tributaire de la charge de la machine.
    const fermer = panel.getByTitle("Fermer");
    await expect(fermer).toBeVisible();
    await fermer.click();
    await expect(panel).toHaveCount(0);
  });

  test("« + Jalon » ouvre le panneau de création", async ({ page }) => {
    await gotoSvar(page);
    await page.getByRole("button", { name: "Jalon", exact: true }).click();
    await expect(page.locator("aside.panel")).toBeVisible();
  });

  // Régression : <Willow> insère deux `.wx-theme` sans hauteur entre le conteneur
  // et le Gantt. Sans `height:100%`, la chaîne casse, SVAR se dimensionne au
  // CONTENU et déborde — sa barre de défilement horizontale recouvre alors la
  // dernière ligne. On vérifie la propriété structurelle : le conteneur ne déborde pas.
  test("le planning ne déborde pas de son conteneur (barre de défilement)", async ({ page }) => {
    await gotoSvar(page);
    const m = await page.evaluate(() => {
      const c = document.querySelector(".svar-planning") as HTMLElement | null;
      const g = document.querySelector('[class*="wx-gantt"]') as HTMLElement | null;
      if (!c || !g) return null;
      return { clientH: c.clientHeight, scrollH: c.scrollHeight, ganttH: g.offsetHeight };
    });
    expect(m).not.toBeNull();
    // Le Gantt REMPLIT son conteneur — c'est ce qui lui rend la main sur son
    // propre défilement. Sans le correctif il se dimensionne au contenu : plus
    // petit que le conteneur quand il y a peu de lignes (ce que voit ce test),
    // plus GRAND dès qu'il y en a beaucoup — et sa barre horizontale recouvre
    // alors la dernière ligne. Les deux bornes verrouillent l'égalité.
    expect(m!.ganttH).toBeGreaterThanOrEqual(m!.clientH - 2);
    expect(m!.ganttH).toBeLessThanOrEqual(m!.clientH + 2);
    expect(m!.scrollH).toBeLessThanOrEqual(m!.clientH + 2);
  });

  test("undo : annuler une création de lien (bouton + DELETE)", async ({ page }) => {
    const calls = await gotoSvar(page);
    await expandRow(page, "Capteurs O2");
    await expandRow(page, "Regulation flux");
    await expect(page.getByText("Etude debit").first()).toBeVisible();

    const undoBtn = page.getByRole("button", { name: /Annuler/ });
    await expect(undoBtn).toBeDisabled(); // rien à annuler au départ

    // Créer un lien (2 clics) → empile une action d'annulation.
    await clickHandle(page, "12", "left");
    await clickHandle(page, "13", "left");
    await expect.poll(() => postDep(calls), { timeout: 5000 }).toBeTruthy();
    await expect(undoBtn).toBeEnabled();

    // Annuler → DELETE de la dépendance créée (id 999 échoé par le mock).
    await undoBtn.click();
    await expect
      .poll(() => calls.find((c) => c.method === "DELETE" && c.path.includes("/api/dependencies/999")), { timeout: 5000 })
      .toBeTruthy();
    await expect(undoBtn).toBeDisabled();
  });
});
