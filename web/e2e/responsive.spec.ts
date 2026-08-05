import { test, expect, type Page } from "@playwright/test";
import { mockApi } from "./mockApi";

// Écrans destinés au téléphone : les deux listes et leurs formulaires. Le
// planning en est délibérément exclu — un Gantt sur 375 px n'a pas de sens.
//
// Le critère éprouvé ici est le plus simple qui soit vrai ou faux : rien ne doit
// dépasser la largeur de la fenêtre. Une capture ne dit pas si c'est le cas, et
// « ça a l'air de tenir » est précisément ce qui laisse passer un champ date de
// 353 px dans un formulaire de 287.

const MOBILE = { width: 375, height: 1200 };

/** Éléments dont le bord droit sort de la fenêtre, avec de quoi les nommer. */
async function debordements(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = [];
    document.querySelectorAll("*").forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.right > window.innerWidth + 1) {
        const e = el as HTMLElement;
        out.push(`${e.tagName}.${e.className || "(sans classe)"} → ${Math.round(r.right)}px`);
      }
    });
    return out;
  });
}

const ECRANS: [string, string][] = [
  ["/projects", "Projets"],
  ["/tasks", "Tâches"],
  ["/projects/new", "Nouveau projet"],
  ["/tasks/new", "Nouvelle tâche"],
  ["/tasks/11/edit", "Modifier la tâche"],
];

for (const [url, titre] of ECRANS) {
  test(`${url} tient dans 375 px`, async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await mockApi(page);
    await page.goto(url);
    await expect(page.getByRole("heading", { name: new RegExp(titre) }).first()).toBeVisible();
    await page.waitForTimeout(600); // laisse les listes annexes se charger

    expect(await debordements(page)).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth))
      .toBeLessThanOrEqual(MOBILE.width);
  });
}

test("la liste des projets devient des cartes, intitulés compris", async ({ page }) => {
  await page.setViewportSize(MOBILE);
  await mockApi(page);
  await page.goto("/projects");
  await expect(page.getByText("Capteurs O2")).toBeVisible();

  // L'en-tête disparaît : c'est `data-label` qui porte alors l'intitulé, sans
  // quoi on lirait une colonne de valeurs sans savoir ce qu'elles désignent.
  await expect(page.locator("table.responsive thead")).toBeHidden();
  const etiquette = await page.locator('td[data-label="Début"]').first()
    .evaluate((el) => getComputedStyle(el, "::before").content);
  expect(etiquette).toContain("Début");
});

test("l'édition inline reste utilisable en carte", async ({ page }) => {
  await page.setViewportSize(MOBILE);
  await mockApi(page);
  await page.goto("/projects");
  // Il faut ouvrir la carte d'abord : repliée, elle ne montre que le nom, donc
  // pas non plus ses boutons. C'est la contrepartie assumée du repliage.
  await page.getByRole("button", { name: /Déplier Capteurs O2/ }).click();
  await page.getByRole("button", { name: "Éditer" }).first().click();
  await expect(page.locator("tr.editing")).toBeVisible();

  // Le cas où l'on risquait le plus de déborder : sept champs de saisie là où il
  // n'y avait que du texte.
  expect(await debordements(page)).toEqual([]);
});

// Contre-épreuve : sur grand écran, la table reste une TABLE. Sans ce test, une
// règle mal bornée transformerait les listes en cartes pour tout le monde.
test("sur grand écran, rien ne change", async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await mockApi(page);
  await page.goto("/projects");
  await expect(page.getByText("Capteurs O2")).toBeVisible();
  await expect(page.locator("table.responsive thead")).toBeVisible();
  const affichage = await page.locator("table.responsive tbody tr").first()
    .evaluate((el) => getComputedStyle(el).display);
  expect(affichage).toBe("table-row");
});

// --- Cartes repliées et recherche -------------------------------------------

test("une carte ne montre que le nom, et s'ouvre au besoin", async ({ page }) => {
  await page.setViewportSize(MOBILE);
  await mockApi(page);
  await page.goto("/projects");
  await expect(page.getByText("Capteurs O2")).toBeVisible();

  // Repliée : le nom, rien d'autre. Une liste de trente projets déroulés sur six
  // lignes chacun ne se parcourt pas au pouce.
  const debut = page.locator('tr:has-text("Capteurs O2") td[data-label="Début"]');
  await expect(debut).toBeHidden();

  await page.getByRole("button", { name: /Déplier Capteurs O2/ }).click();
  await expect(debut).toBeVisible();
  // Le bouton dit maintenant l'inverse : son intitulé suit l'état, sans quoi un
  // lecteur d'écran annoncerait « déplier » sur une carte déjà ouverte.
  await expect(page.getByRole("button", { name: /Replier Capteurs O2/ })).toBeVisible();

  await page.getByRole("button", { name: /Replier Capteurs O2/ }).click();
  await expect(debut).toBeHidden();
});

test("une ligne en cours d'édition reste dépliée", async ({ page }) => {
  await page.setViewportSize(MOBILE);
  await mockApi(page);
  await page.goto("/projects");
  await page.getByRole("button", { name: /Déplier Capteurs O2/ }).click();
  await page.getByRole("button", { name: "Éditer" }).first().click();
  // On ne peut pas remplir un formulaire dont on cache les champs : la ligne en
  // édition est exclue du repliage, même si la carte était fermée avant.
  await expect(page.locator('tr.editing td[data-label="Début"]')).toBeVisible();
});

test("la recherche filtre sur toutes les colonnes, accents compris", async ({ page }) => {
  await page.setViewportSize(MOBILE);
  await mockApi(page);
  await page.goto("/projects");
  await expect(page.getByText("Capteurs O2")).toBeVisible();

  const champ = page.getByLabel("Rechercher un projet");
  // Sur une colonne qui n'est PAS le nom : la recherche porte sur toute la ligne.
  await champ.fill("Optimisation");
  await expect(page.locator("tbody tr")).toHaveCount(2);

  await champ.fill("regulation"); // sans majuscule
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(page.getByText("Regulation flux")).toBeVisible();

  await champ.fill("introuvable");
  await expect(page.locator("tbody tr")).toHaveCount(0);
});

test("la recherche sert aussi sur grand écran", async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await mockApi(page);
  await page.goto("/tasks");
  await expect(page.getByText("Choix capteurs")).toBeVisible();
  await page.getByLabel("Rechercher une tâche").fill("calibration");
  await expect(page.locator("tbody tr")).toHaveCount(1);
});
