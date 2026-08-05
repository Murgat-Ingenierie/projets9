import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { JournalActivite } from "./JournalActivite";
import { useAuth } from "../auth";

// L'immuabilité est le sujet, et elle se vérifie par ce qui MANQUE : aucun moyen
// de modifier une entrée publiée. La suppression, elle, n'est offerte qu'aux
// administrateurs — sans quoi supprimer puis republier reviendrait à réécrire.

const list = vi.fn();
const create = vi.fn();
const remove = vi.fn();

vi.mock("../api/endpoints", () => ({
  activites: {
    list: (...a: unknown[]) => list(...a),
    create: (...a: unknown[]) => create(...a),
    remove: (...a: unknown[]) => remove(...a),
  },
}));
vi.mock("../auth", () => ({ useAuth: vi.fn() }));

const entree = (id: number, texte: string, auteur = "Mathieu Pourbaix") => ({
  id, tache_id: 5, texte, auteur_id: 2, auteur_nom: auteur,
  created_at: "2026-08-05T14:32:00Z", updated_at: "2026-08-05T14:32:00Z",
});

function connecte(role: "admin" | "membre") {
  vi.mocked(useAuth).mockReturnValue({ user: { id: 1, role } } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  list.mockResolvedValue([entree(2, "ensuite"), entree(1, "d'abord")]);
  create.mockResolvedValue(entree(3, "nouveau"));
  remove.mockResolvedValue(undefined);
  connecte("admin");
});
afterEach(cleanup);

describe("JournalActivite", () => {
  it("affiche les entrées de SA tâche, signées et horodatées", async () => {
    render(<JournalActivite tacheId={5} />);
    await screen.findByText("ensuite");
    expect(list).toHaveBeenCalledWith(5);
    expect(screen.getAllByText("Mathieu Pourbaix").length).toBe(2);
    expect(screen.getAllByText(/2026/).length).toBeGreaterThan(0);
  });

  it("publier envoie le texte détouré, et vide la zone APRÈS l'écriture", async () => {
    render(<JournalActivite tacheId={5} />);
    await screen.findByText("ensuite");
    const zone = screen.getByLabelText("Nouvelle entrée d'activité") as HTMLTextAreaElement;
    fireEvent.change(zone, { target: { value: "  J'ai vissé les boulons  " } });
    fireEvent.click(screen.getByRole("button", { name: "Publier" }));
    await waitFor(() =>
      expect(create).toHaveBeenCalledWith({ tache_id: 5, texte: "J'ai vissé les boulons" }),
    );
    await waitFor(() => expect(zone.value).toBe(""));
  });

  it("un refus de l'API conserve le compte rendu rédigé", async () => {
    create.mockRejectedValue(new Error("boum"));
    render(<JournalActivite tacheId={5} />);
    await screen.findByText("ensuite");
    const zone = screen.getByLabelText("Nouvelle entrée d'activité") as HTMLTextAreaElement;
    fireEvent.change(zone, { target: { value: "Texte long à ne pas perdre" } });
    fireEvent.click(screen.getByRole("button", { name: "Publier" }));
    await waitFor(() => expect(create).toHaveBeenCalled());
    expect(zone.value).toBe("Texte long à ne pas perdre");
  });

  it("une zone vide ou blanche n'est pas publiable", async () => {
    render(<JournalActivite tacheId={5} />);
    await screen.findByText("ensuite");
    const bouton = screen.getByRole("button", { name: "Publier" }) as HTMLButtonElement;
    expect(bouton.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Nouvelle entrée d'activité"), { target: { value: "   " } });
    expect(bouton.disabled).toBe(true);
  });

  // Le point central : rien ne permet de rouvrir une entrée publiée.
  it("aucune entrée n'est modifiable", async () => {
    render(<JournalActivite tacheId={5} />);
    await screen.findByText("ensuite");
    expect(screen.queryByRole("button", { name: /Modifier|Éditer/ })).toBeNull();
    // Le texte est rendu, pas saisi : la seule zone de saisie est celle du haut.
    expect(screen.getAllByRole("textbox")).toHaveLength(1);
    // Et l'utilisateur est prévenu AVANT d'écrire.
    expect(screen.getByText(/ne peut plus être modifiée/)).toBeTruthy();
  });

  it("un membre ne se voit pas proposer la suppression", async () => {
    connecte("membre");
    render(<JournalActivite tacheId={5} />);
    await screen.findByText("ensuite");
    expect(screen.queryByRole("button", { name: /Supprimer/ })).toBeNull();
  });

  it("un administrateur supprime, après confirmation", async () => {
    vi.stubGlobal("confirm", () => true);
    render(<JournalActivite tacheId={5} />);
    await screen.findByText("ensuite");
    fireEvent.click(screen.getAllByRole("button", { name: /Supprimer/ })[0]);
    await waitFor(() => expect(remove).toHaveBeenCalledWith(2));
    vi.unstubAllGlobals();
  });

  it("confirmation refusée : rien n'est supprimé", async () => {
    vi.stubGlobal("confirm", () => false);
    render(<JournalActivite tacheId={5} />);
    await screen.findByText("ensuite");
    fireEvent.click(screen.getAllByRole("button", { name: /Supprimer/ })[0]);
    expect(remove).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
