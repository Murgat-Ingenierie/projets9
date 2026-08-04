import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BoutonSupprimer } from "./BoutonSupprimer";
import { useAuth } from "../auth";

// Le versant NÉGATIF est l'objet même de ce composant : un membre ne doit PAS
// voir le bouton. Les neuf endpoints DELETE de l'API exigent `require_admin`
// depuis C7, mais l'interface continuait de les offrir à tout le monde — on
// proposait une action pour répondre 403 ensuite.

vi.mock("../auth", () => ({ useAuth: vi.fn() }));
const auth = vi.mocked(useAuth);


const commeRole = (role: string | null) =>
  auth.mockReturnValue({ user: role ? ({ role } as never) : null, loading: false, deconnexion: () => {} });

beforeEach(() => auth.mockReset());
afterEach(() => cleanup());

describe("BoutonSupprimer", () => {
  it("visible pour un administrateur", () => {
    commeRole("admin");
    render(<BoutonSupprimer onClick={() => {}} />);
    expect(screen.getByRole("button", { name: "Supprimer" })).toBeTruthy();
  });

  it("ABSENT pour un membre — pas seulement désactivé", () => {
    // Désactiver le bouton laisserait croire qu'un droit manque pour cette ligne
    // précise ; le retirer dit que l'action n'est pas la sienne. Et un bouton
    // désactivé reste dans le DOM, donc réactivable depuis la console.
    commeRole("membre");
    render(<BoutonSupprimer onClick={() => {}} />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("absent tant que l'utilisateur n'est pas résolu", () => {
    // Au chargement, `user` est null. Afficher le bouton puis le retirer ferait
    // clignoter une action interdite — et permettrait de la cliquer entre-temps.
    commeRole(null);
    render(<BoutonSupprimer onClick={() => {}} />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("garde le libellé et la classe qu'on lui passe", () => {
    // Certaines tables n'ont la place que d'un « × ».
    commeRole("admin");
    render(<BoutonSupprimer onClick={() => {}} className="btn danger mini">×</BoutonSupprimer>);
    const b = screen.getByRole("button", { name: "×" });
    expect(b.className).toBe("btn danger mini");
  });

  it("déclenche l'action au clic", () => {
    commeRole("admin");
    const onClick = vi.fn();
    render(<BoutonSupprimer onClick={onClick} />);
    screen.getByRole("button").click();
    expect(onClick).toHaveBeenCalledOnce();
  });
});
