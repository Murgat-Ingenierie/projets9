import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ClaudePage from "./ClaudePage";
import { claude } from "../api/endpoints";

// Défaut verrouillé ici (#131) : la zone de saisie est désactivée pendant
// l'appel, ce qui lui fait perdre le focus. Il fallait recliquer dedans avant
// chaque message — pénible dans un échange à plusieurs tours.

vi.mock("../api/endpoints", () => ({ claude: { chat: vi.fn() } }));
const chat = vi.mocked(claude.chat);

/** Contrôle la réponse de l'API pour observer l'avant ET l'après. */
function reponseDifferee() {
  let resoudre!: (v: Awaited<ReturnType<typeof claude.chat>>) => void;
  let rejeter!: (e: unknown) => void;
  chat.mockReturnValue(
    new Promise((ok, ko) => {
      resoudre = ok;
      rejeter = ko;
    }),
  );
  return { resoudre, rejeter };
}

/**
 * Le navigateur retire le focus d'un champ désactivé ; jsdom non (et ignore
 * même `blur()` sur un champ désactivé). On déplace donc le focus ailleurs, à
 * la main, pour que le test ne passe pas par accident.
 */
function perdreLeFocus() {
  const ailleurs = document.body.appendChild(document.createElement("button"));
  ailleurs.focus();
  return ailleurs;
}

/** Envoie un message au clavier, comme l'utilisateur le fait. */
function envoyer(texte: string) {
  const zone = screen.getByLabelText("Votre message");
  fireEvent.change(zone, { target: { value: texte } });
  fireEvent.keyDown(zone, { key: "Enter" });
}

beforeEach(() => {
  chat.mockReset();
  // jsdom n'implémente pas le défilement ; la page s'en sert pour suivre le fil.
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

describe("focus de la zone de saisie", () => {
  it("revient dans la zone après la réponse, prêt pour le message suivant", async () => {
    const { resoudre } = reponseDifferee();
    render(<ClaudePage />);
    const zone = screen.getByLabelText("Votre message") as HTMLTextAreaElement;

    envoyer("Le planning ne se charge pas");
    expect(zone.disabled).toBe(true);
    const ailleurs = perdreLeFocus();
    expect(document.activeElement).toBe(ailleurs);

    await act(async () => resoudre({ reply: "Sur quel écran ?", issue: null }));

    expect(zone.disabled).toBe(false);
    expect(document.activeElement).toBe(zone);
  });

  it("revient aussi après une erreur, où la saisie est restituée", async () => {
    const { rejeter } = reponseDifferee();
    render(<ClaudePage />);
    const zone = screen.getByLabelText("Votre message") as HTMLTextAreaElement;

    envoyer("Message perdu ?");
    perdreLeFocus();

    await act(async () => rejeter(new Error("relais indisponible")));

    expect(zone.value).toBe("Message perdu ?");
    expect(document.activeElement).toBe(zone);
  });
});

// Refonte du chat (#130) : ce qui se vérifie hors navigateur — l'accessibilité
// du nouveau bouton-icône, l'indicateur d'attente et la hauteur de la zone.
describe("zone de saisie et indicateur d'attente", () => {
  it("le bouton-icône garde un nom accessible et n'envoie rien de vide", () => {
    render(<ClaudePage />);
    const bouton = screen.getByRole("button", { name: "Envoyer" }) as HTMLButtonElement;
    expect(bouton.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Votre message"), { target: { value: "   " } });
    expect(bouton.disabled).toBe(true);
  });

  it("annonce que Claude rédige, puis retire l'indicateur à la réponse", async () => {
    const { resoudre } = reponseDifferee();
    render(<ClaudePage />);

    envoyer("Le planning ne se charge pas");
    expect(screen.getByRole("status", { name: "Claude rédige sa réponse" })).toBeTruthy();

    await act(async () => resoudre({ reply: "Sur quel écran ?", issue: null }));
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByText("Sur quel écran ?")).toBeTruthy();
  });

  it("suit la hauteur du contenu, plafonnée, et se rétracte une fois vidée", () => {
    render(<ClaudePage />);
    const zone = screen.getByLabelText("Votre message") as HTMLTextAreaElement;
    // jsdom ne calcule aucune mise en page : on simule la hauteur du contenu.
    let contenu = 120;
    Object.defineProperty(zone, "scrollHeight", { configurable: true, get: () => contenu });

    fireEvent.change(zone, { target: { value: "ligne 1\nligne 2\nligne 3" } });
    expect(zone.style.height).toBe("120px");

    contenu = 900;
    fireEvent.change(zone, { target: { value: "un très long message…" } });
    expect(zone.style.height).toBe("200px");

    contenu = 38;
    fireEvent.change(zone, { target: { value: "" } });
    expect(zone.style.height).toBe("38px");
  });
});
