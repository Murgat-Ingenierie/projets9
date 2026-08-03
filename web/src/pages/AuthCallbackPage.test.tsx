import { StrictMode } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import AuthCallbackPage from "./AuthCallbackPage";
import { seConnecter, terminerConnexion } from "../auth/oidc";

// Ce fichier existe pour un défaut précis, et le test central le verrouille.
//
// L'échange du code se faisait dans `AuthProvider`, qui nettoyait ensuite l'URL
// avec `window.history.replaceState`. Cet appel change la barre d'adresse SANS
// prévenir React Router : le routeur restait sur `/auth/callback` et rendait son
// écran d'attente pour toujours, pendant que l'adresse affichait « / ». Le
// planning n'apparaissait jamais.
//
// Le routeur utilisé ici est un routeur EN MÉMOIRE : il n'a pas d'historique de
// navigateur du tout. Un retour à `replaceState` n'y produirait donc
// strictement rien, et « PLANNING » ne s'afficherait jamais. C'est ce qui donne
// sa valeur au test — il ne peut pas passer par accident.

vi.mock("../auth/oidc", () => ({
  terminerConnexion: vi.fn(),
  seConnecter: vi.fn(async () => {}),
}));

const echange = vi.mocked(terminerConnexion);
const connexion = vi.mocked(seConnecter);

/** Monte la page à l'endroit exact où Keycloak dépose l'utilisateur. */
function monter({ strict = false }: { strict?: boolean } = {}) {
  const arbre = (
    <MemoryRouter initialEntries={["/auth/callback?code=abc&state=xyz"]}>
      <Routes>
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="/" element={<p>PLANNING</p>} />
      </Routes>
    </MemoryRouter>
  );
  return render(strict ? <StrictMode>{arbre}</StrictMode> : arbre);
}

beforeEach(() => {
  echange.mockReset().mockResolvedValue({} as never);
  connexion.mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
  // Nettoyage EXPLICITE : testing-library ne l'installe tout seul que si Vitest
  // tourne avec `globals`, ce qui n'est pas le cas ici (les tests importent
  // `describe`/`it` nommément). Sans lui, le DOM s'accumule d'un test à l'autre
  // et une assertion peut trouver un élément rendu par le test PRÉCÉDENT — donc
  // passer pour la mauvaise raison.
  cleanup();
  vi.clearAllMocks();
});

describe("retour de Keycloak", () => {
  it("cède la place à la destination une fois le code échangé", async () => {
    monter();
    expect(await screen.findByText("PLANNING")).toBeTruthy();
  });

  it("annonce ce qui se passe pendant l'échange", () => {
    echange.mockReturnValue(new Promise(() => {})); // jamais résolu
    monter();
    expect(screen.getByText(/connexion en cours/i)).toBeTruthy();
  });

  it("navigue aussi lorsque le composant est monté deux fois (StrictMode)", async () => {
    // Piège rencontré en écrivant ce correctif : un garde « ne lancer qu'une
    // fois » par `useRef` fait passer le premier montage — dont la fermeture est
    // ANNULÉE par le démontage de StrictMode — et court-circuite le second. Plus
    // personne ne navigue, et la page reste figée exactement comme avant.
    monter({ strict: true });
    expect(await screen.findByText("PLANNING")).toBeTruthy();
  });

  it("ne remplace pas l'entrée d'historique par la page de retour", async () => {
    // `replace: true` : revenir en arrière depuis le planning ne doit pas
    // ramener sur une URL de retour dont le code est déjà consommé.
    monter();
    await screen.findByText("PLANNING");
    expect(screen.queryByText(/connexion en cours/i)).toBeNull();
  });
});

describe("échange impossible", () => {
  const echec = () => echange.mockRejectedValue(new Error("No matching state found in storage"));

  it("affiche un message qui explique, plutôt que de rester figée", async () => {
    echec();
    monter();
    expect(await screen.findByText(/connexion interrompue/i)).toBeTruthy();
    expect(screen.getByText(/ne sert qu'une fois/i)).toBeTruthy();
  });

  it("ne navigue pas : la destination exigerait une session qu'on n'a pas", async () => {
    echec();
    monter();
    await screen.findByText(/connexion interrompue/i);
    expect(screen.queryByText("PLANNING")).toBeNull();
  });

  it("offre de recommencer, plutôt que de laisser dans une impasse", async () => {
    echec();
    monter();
    (await screen.findByRole("button", { name: /se reconnecter/i })).click();
    expect(connexion).toHaveBeenCalledOnce();
  });

  it("conserve le message technique, utile au débogage", async () => {
    echec();
    monter();
    expect(await screen.findByText(/No matching state/i)).toBeTruthy();
  });
});
