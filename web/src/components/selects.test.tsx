import { afterEach, describe, it, expect } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { EpicSelect, ProjectSelect } from "./selects";
import type { Epic, Project } from "../types";

const EPICS = [
  { trigramme: "EEF", nom: "Entreprise efficace" },
  { trigramme: "O50", nom: "Objectif 50%" },
] as unknown as Epic[];
const PROJETS = [{ id: 1, nom: "Capteurs O2" }] as unknown as Project[];

// Le défaut d'origine : `value=""` ne correspondait à aucune option quand le champ
// était requis, alors le navigateur affichait la PREMIÈRE de la liste. L'écran
// montrait « Entreprise efficace » sélectionné, l'état valait "", et la création
// partait sans epic — refusée par l'API pour une raison illisible.
// Le nettoyage n'est pas automatique ici (pas de `globals` dans la config vitest) :
// sans lui, les rendus s'empilent et `getByRole` en trouve plusieurs.
afterEach(cleanup);

describe("sélecteurs : un état vide doit RESTER vide à l'écran", () => {
  it("EpicSelect requis : rien de choisi ⇒ la valeur reste vide", () => {
    render(<EpicSelect value="" onChange={() => {}} required epics={EPICS} />);
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.value).toBe("");
    // C'est l'option vide qui l'empêche de retomber sur « EEF ».
    expect(screen.getByRole("option", { name: "— Choisir —" })).toBeTruthy();
  });

  it("EpicSelect requis : vide ⇒ le formulaire est invalide (le required opère)", () => {
    render(<EpicSelect value="" onChange={() => {}} required epics={EPICS} />);
    expect((screen.getByRole("combobox") as HTMLSelectElement).checkValidity()).toBe(false);
  });

  it("EpicSelect requis : une fois choisi, le formulaire redevient valide", () => {
    render(<EpicSelect value="O50" onChange={() => {}} required epics={EPICS} />);
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.value).toBe("O50");
    expect(select.checkValidity()).toBe(true);
  });

  it("ProjectSelect requis : même garantie (création de tâche)", () => {
    render(<ProjectSelect value={null} onChange={() => {}} required projects={PROJETS} />);
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.value).toBe("");
    expect(select.checkValidity()).toBe(false);
  });
});
