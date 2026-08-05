import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { TaskFormFields } from "./TaskFormFields";

// Rattacher une équipe à une tâche impose d'allouer des heures : la base porte
// `heures_allouees NOT NULL` avec une contrainte `> 0`. On ne peut donc pas offrir
// « l'équipe seule ». Le champ heures n'apparaît qu'une fois l'équipe choisie, et
// devient alors obligatoire — c'est le navigateur qui retient l'envoi, avant la
// requête, plutôt que l'API qui le refuse après coup.

vi.mock("../api/endpoints", () => ({
  projects: { list: () => Promise.resolve([{ id: 1, nom: "Capteurs O2" }]) },
  users: { annuaire: () => Promise.resolve([]) },
  equipes: { list: () => Promise.resolve([{ id: 7, nom: "Equipe A" }]) },
}));

afterEach(cleanup);

const alloc = (equipeId: number | null, heures = "") => ({
  equipeId, setEquipeId: () => {}, heures, setHeures: () => {},
});

describe("TaskFormFields — rattachement d'une équipe", () => {
  it("en ÉDITION, aucun champ d'équipe : les allocations se règlent dans Charge équipes", () => {
    render(<TaskFormFields draft={{}} setDraft={() => {}} />);
    expect(screen.queryByLabelText(/Équipe/)).toBeNull();
    expect(screen.queryByLabelText("Heures allouées")).toBeNull();
  });

  it("à la création, l'équipe est proposée mais facultative", () => {
    render(<TaskFormFields draft={{}} setDraft={() => {}} allocation={alloc(null)} />);
    const select = screen.getByLabelText(/Équipe/) as HTMLSelectElement;
    expect(select.value).toBe("");
    expect(select.checkValidity()).toBe(true); // rien de choisi ⇒ le formulaire part
    // Pas d'équipe, pas d'heures : un champ obligatoire vide bloquerait la création
    // d'une tâche que personne ne voulait allouer.
    expect(screen.queryByLabelText("Heures allouées")).toBeNull();
  });

  it("une équipe choisie fait apparaître des heures OBLIGATOIRES", () => {
    render(<TaskFormFields draft={{}} setDraft={() => {}} allocation={alloc(7)} />);
    const heures = screen.getByLabelText("Heures allouées") as HTMLInputElement;
    expect(heures.required).toBe(true);
    expect(heures.checkValidity()).toBe(false); // vide ⇒ l'envoi est retenu
  });

  it("les heures refusent zéro, que la base interdit", () => {
    render(<TaskFormFields draft={{}} setDraft={() => {}} allocation={alloc(7, "0")} />);
    expect((screen.getByLabelText("Heures allouées") as HTMLInputElement).checkValidity()).toBe(false);
  });

  it("une valeur positive passe", () => {
    render(<TaskFormFields draft={{}} setDraft={() => {}} allocation={alloc(7, "3.5")} />);
    expect((screen.getByLabelText("Heures allouées") as HTMLInputElement).checkValidity()).toBe(true);
  });
});
