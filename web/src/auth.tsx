import React, { createContext, useContext, useEffect, useState } from "react";
import { users } from "./api/endpoints";
import {
  CHEMIN_CALLBACK,
  estActif,
  seConnecter,
  seDeconnecter,
  terminerConnexion,
  utilisateurCourant,
} from "./auth/oidc";
import type { User } from "./types";

// Deux modes, choisis par la configuration (cf. auth/oidc.ts) :
//
// - **OIDC actif** : une session Keycloak est exigée. Sans elle, redirection vers
//   le serveur d'authentification — c'est le garde de route, retrouvé après avoir
//   été retiré en #36.
// - **OIDC inactif** : comportement inchangé — pas de login, l'API tourne en
//   AUTH_DISABLED et `users.me()` renvoie l'admin par défaut.
//
// Dans les deux cas, `user` reste l'utilisateur **local** (table `users`), pas les
// claims du jeton : c'est lui que référencent `responsable_id` et l'audit
// `updated_by`. Le rapprochement est fait côté API, au provisioning.

interface AuthCtx {
  user: User | null;
  loading: boolean;
  /** null quand l'OIDC est inactif : il n'y a rien à déconnecter. */
  deconnexion: (() => void) | null;
}

const Ctx = createContext<AuthCtx>(null!);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    let annule = false;

    async function demarrer() {
      if (!estActif()) {
        try {
          const u = await users.me();
          if (!annule) setUser(u);
        } catch {
          if (!annule) setUser(null);
        } finally {
          if (!annule) setLoading(false);
        }
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
    return (
      <div style={{ padding: 32, maxWidth: 640 }}>
        <h2>Connexion impossible</h2>
        <p>{erreur}</p>
        <button className="btn" onClick={() => void seDeconnecter()}>
          Se déconnecter
        </button>
      </div>
    );
  }

  return (
    <Ctx.Provider
      value={{ user, loading, deconnexion: estActif() ? () => void seDeconnecter() : null }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  return useContext(Ctx);
}
