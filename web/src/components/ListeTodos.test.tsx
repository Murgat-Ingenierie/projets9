import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { ListeTodos } from "./ListeTodos";

// Ce qui compte ici n'est pas l'affichage mais CE QUI EST ENVOYÉ. Cocher une case
// ne doit transmettre que `fait` : la route applique tout champ fourni, donc y
// joindre le libellé rouvrirait la porte au défaut déjà rencontré sur les projets
// (un brouillon complet envoyé en bloc, qui écrasait une description).

const list = vi.fn();
const create = vi.fn();
const update = vi.fn();
const remove = vi.fn();

vi.mock("../api/endpoints", () => ({
  todos: {
    list: (...a: unknown[]) => list(...a),
    create: (...a: unknown[]) => create(...a),
    update: (...a: unknown[]) => update(...a),
    remove: (...a: unknown[]) => remove(...a),
  },
}));

const todo = (id: number, libelle: string, fait = false) => ({
  id, tache_id: 5, libelle, fait, created_at: "", updated_at: "",
});

beforeEach(() => {
  vi.clearAllMocks();
  list.mockResolvedValue([todo(1, "Visser les boulons"), todo(2, "Purger", true)]);
  create.mockResolvedValue(todo(3, "Nouveau"));
  update.mockResolvedValue(todo(1, "Visser les boulons", true));
  remove.mockResolvedValue(undefined);
});
afterEach(cleanup);

describe("ListeTodos", () => {
  it("charge la liste de SA tâche, et compte ce qui est fait", async () => {
    render(<ListeTodos tacheId={5} />);
    await screen.findByText("Visser les boulons");
    expect(list).toHaveBeenCalledWith(5);
    expect(screen.getByText("(1/2)")).toBeTruthy();
  });

  it("cocher n'envoie QUE `fait`", async () => {
    render(<ListeTodos tacheId={5} />);
    await screen.findByText("Visser les boulons");
    fireEvent.click(screen.getByRole("checkbox", { name: "Visser les boulons" }));
    await waitFor(() => expect(update).toHaveBeenCalled());
    expect(update).toHaveBeenCalledWith(1, { fait: true });
  });

  it("décocher renvoie l'inverse, pas un `true` figé", async () => {
    render(<ListeTodos tacheId={5} />);
    await screen.findByText("Purger");
    fireEvent.click(screen.getByRole("checkbox", { name: "Purger" }));
    await waitFor(() => expect(update).toHaveBeenCalledWith(2, { fait: false }));
  });

  it("ajouter écrit puis recharge ; le champ ne se vide qu'après", async () => {
    render(<ListeTodos tacheId={5} />);
    await screen.findByText("Visser les boulons");
    const champ = screen.getByLabelText("Ajouter un point") as HTMLInputElement;
    fireEvent.change(champ, { target: { value: "Contrôler la pompe" } });
    fireEvent.click(screen.getByRole("button", { name: "Ajouter" }));
    await waitFor(() => expect(create).toHaveBeenCalledWith({ tache_id: 5, libelle: "Contrôler la pompe" }));
    await waitFor(() => expect(champ.value).toBe(""));
  });

  it("un libellé vide ou blanc n'est pas envoyable", async () => {
    render(<ListeTodos tacheId={5} />);
    await screen.findByText("Visser les boulons");
    const bouton = screen.getByRole("button", { name: "Ajouter" }) as HTMLButtonElement;
    expect(bouton.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Ajouter un point"), { target: { value: "   " } });
    expect(bouton.disabled).toBe(true);
    expect(create).not.toHaveBeenCalled();
  });

  // Si l'API refuse, la saisie doit rester à l'écran : la vider d'abord ferait
  // retaper la ligne à quelqu'un qui n'y est pour rien.
  it("un refus de l'API conserve la saisie", async () => {
    create.mockRejectedValue(new Error("boum"));
    render(<ListeTodos tacheId={5} />);
    await screen.findByText("Visser les boulons");
    const champ = screen.getByLabelText("Ajouter un point") as HTMLInputElement;
    fireEvent.change(champ, { target: { value: "Contrôler la pompe" } });
    fireEvent.click(screen.getByRole("button", { name: "Ajouter" }));
    await waitFor(() => expect(create).toHaveBeenCalled());
    expect(champ.value).toBe("Contrôler la pompe");
  });

  it("retirer supprime la ligne visée", async () => {
    render(<ListeTodos tacheId={5} />);
    await screen.findByText("Purger");
    fireEvent.click(screen.getByRole("button", { name: /Retirer « Purger »/ }));
    await waitFor(() => expect(remove).toHaveBeenCalledWith(2));
  });
});
