import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { EpicFormFields } from "./EpicFormFields";
import { MilestoneFormFields } from "./MilestoneFormFields";
import { ProjectFormFields } from "./ProjectFormFields";
import { TaskFormFields } from "./TaskFormFields";

// Chaque libellé de formulaire doit désigner SON champ.
//
// Les `<label>` étaient nus : posés en frères du contrôle dans la grille, sans
// `htmlFor`. Rien ne les reliait — un lecteur d'écran annonçait un champ sans
// nom, et cliquer sur l'intitulé ne plaçait pas le curseur. Le défaut s'est vu
// en écrivant un test e2e, où `getByLabel("Nom")` ne trouvait rien.
//
// `getByLabelText` suit exactement le chemin d'association du navigateur : s'il
// trouve le champ, l'intitulé le désigne vraiment. C'est donc l'outil juste ici,
// et ces tests échouent si un `htmlFor` disparaît ou vise un id inexistant.

vi.mock("../api/endpoints", () => ({
  epics: { list: () => Promise.resolve([]) },
  projects: { list: () => Promise.resolve([]) },
  users: { annuaire: () => Promise.resolve([]) },
}));

afterEach(cleanup);

/** Le champ trouvé par son intitulé est bien du type attendu. */
function champ(intitule: string | RegExp): HTMLElement {
  return screen.getByLabelText(intitule);
}

describe("libellés reliés à leur champ", () => {
  it("projet", () => {
    render(<ProjectFormFields draft={{}} setDraft={() => {}} />);
    expect(champ("Epic").tagName).toBe("SELECT");
    expect(champ("Nom").tagName).toBe("INPUT");
    expect(champ("Description").tagName).toBe("TEXTAREA");
    expect(champ("Date de début")).toHaveProperty("type", "date");
    expect(champ("Date de fin")).toHaveProperty("type", "date");
    expect(champ("Responsable").tagName).toBe("SELECT");
    expect(champ("Statut").tagName).toBe("SELECT");
  });

  it("tâche", () => {
    render(<TaskFormFields draft={{}} setDraft={() => {}} />);
    expect(champ("Projet").tagName).toBe("SELECT");
    expect(champ("Nom").tagName).toBe("INPUT");
    expect(champ("Date de début")).toHaveProperty("type", "date");
    expect(champ("Date de fin")).toHaveProperty("type", "date");
    expect(champ("Responsable").tagName).toBe("SELECT");
    // La bascule : le libellé doit viser la CASE réelle, pas l'habillage.
    expect(champ("Fini")).toHaveProperty("type", "checkbox");
  });

  it("epic", () => {
    render(<EpicFormFields draft={{}} setDraft={() => {}} allowTrigrammeEdit />);
    expect(champ("Trigramme (3 lettres)").tagName).toBe("INPUT");
    expect(champ("Nom").tagName).toBe("INPUT");
    expect(champ("Critère de réussite").tagName).toBe("TEXTAREA");
    expect(champ("Raison de la date de fin").tagName).toBe("INPUT");
    expect(champ("Date de fin prévue")).toHaveProperty("type", "date");
    expect(champ("Jalon de fin maximum")).toHaveProperty("type", "date");
    expect(champ("Statut").tagName).toBe("SELECT");
    expect(champ("Catégorie").tagName).toBe("SELECT");
    // Le libellé vise le champ, pas le `<div>` qui l'entoure pour afficher
    // le code hexadécimal à côté.
    expect(champ("Couleur")).toHaveProperty("type", "color");
  });

  it("jalon", () => {
    render(<MilestoneFormFields draft={{}} setDraft={() => {}} />);
    expect(champ("Nom").tagName).toBe("INPUT");
    expect(champ("Date")).toHaveProperty("type", "date");
    expect(champ("Projets rattachés (au moins 1)").tagName).toBe("INPUT");
    expect(champ("Atteint")).toHaveProperty("type", "checkbox");
  });

  // Deux plages de dates sur un même écran ne doivent pas partager leurs ids :
  // le second libellé « Date de début » désignerait alors le premier champ.
  it("deux formulaires côte à côte gardent des identifiants distincts", () => {
    render(
      <>
        <ProjectFormFields draft={{}} setDraft={() => {}} />
        <ProjectFormFields draft={{}} setDraft={() => {}} />
      </>
    );
    const debuts = screen.getAllByLabelText("Date de début");
    expect(debuts).toHaveLength(2);
    expect(debuts[0].id).not.toBe(debuts[1].id);
  });
});
