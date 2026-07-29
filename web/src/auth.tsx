import React, { createContext, useContext, useEffect, useState } from "react";
import { users } from "./api/endpoints";
import {
  CHEMIN_CALLBACK,
  defautDeConfiguration,
  seConnecter,
  seDeconnecter,
  terminerConnexion,
  utilisateurCourant,
} from "./auth/oidc";
import type { User } from "./types";

// Un seul mode : une session Keycloak est exigée. Sans elle, redirection vers le
// serveur d'authentification — c'est le garde de route, retrouvé après avoir été
// retiré en #36.
//
// Le mode « OIDC inactif », qui accompagnait la bascule, a disparu avec
// l'authentification maison. Une configuration incomplète n'ouvre donc plus
// l'application sans login : elle s'affiche, ce qui est le seul comportement
// honnête quand l'API, elle, exige un jeton pour tout.
//
// `user` reste l'utilisateur **local** (table `users`), pas les claims du jeton :
// c'est lui que référencent `responsable_id` et l'audit `updated_by`. Le
// rapprochement est fait côté API, au provisioning.

interface AuthCtx {
  user: User | null;
  loading: boolean;
  deconnexion: () => void;
}

const Ctx = createContext<AuthCtx>(null!);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    let annule = false;

    async function demarrer() {
      const defaut = defautDeConfiguration();
      if (defaut !== null) {
        setErreur(defaut);
        setLoading(false);
        return;
      }

      try {
        // Retour de Keycloak : on échange le code, puis on nettoie l'URL — ni
        // `code` ni `state` n'ont à rester dans la barre d'adresse, ni dans
        // l'historique, ni dans un lien partagé par mégarde.
        if (window.location.pathname === CHEMIN_CALLBACK) {
          await terminerConnexion();
          window.history.replaceState({}, "", "/");
        }

        const oidc = await utilisateurCourant();
        if (!oidc || oidc.expired) {
          await seConnecter(); // redirection : la suite ne s'exécute pas
          return;
        }

        // Session valide : l'API rapproche le jeton du compte local — et le crée
        // s'il s'agit de la première connexion.
        const u = await users.me();
        if (!annule) setUser(u);
      } catch (e) {
        // Échec bloquant : mieux vaut l'afficher qu'une page blanche. Le cas le
        // plus courant sera un 403 « accès refusé à cette application », quand
        // le rôle `app-projets9-access` manque.
        if (!annule) setErreur(e instanceof Error ? e.message : String(e));
      } finally {
        if (!annule) setLoading(false);
      }
    }

    void demarrer();
    return () => {
      annule = true;
    };
  }, []);

  if (erreur) {
    // Pas de bouton « Se déconnecter » quand c'est la CONFIGURATION qui manque :
    // il n'y a pas de session à fermer, et le proposer ferait lever le
    // gestionnaire OIDC — une seconde erreur par-dessus la première.
    const configurable = defautDeConfiguration() === null;
    return (
      <div style={{ padding: 32, maxWidth: 640 }}>
        <h2>{configurable ? "Connexion impossible" : "Application mal configurée"}</h2>
        <p>{erreur}</p>
        {configurable && (
          <button className="btn" onClick={() => void seDeconnecter()}>
            Se déconnecter
          </button>
        )}
      </div>
    );
  }

  return (
    <Ctx.Provider value={{ user, loading, deconnexion: () => void seDeconnecter() }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  return useContext(Ctx);
}
