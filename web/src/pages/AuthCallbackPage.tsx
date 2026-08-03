// Page de retour de Keycloak (`/auth/callback`) — elle ne fait qu'une chose :
// échanger le code d'autorisation, puis céder la place.
//
// Elle existe parce que faire cet échange depuis `AuthProvider`, sur la route
// d'accueil, produisait une panne durable. Le provider nettoyait l'URL avec
// `window.history.replaceState`, qui change la barre d'adresse **sans prévenir
// React Router** : le routeur continuait de croire qu'il était sur
// `/auth/callback` et rendait indéfiniment son écran d'attente, pendant que
// l'adresse affichait « / ». Le planning n'apparaissait jamais. Symptôme
// caractéristique — une URL et un contenu qui se contredisent.
//
// D'où la règle tenue ici : **on quitte cette page par une navigation du
// routeur**, jamais en manipulant l'historique du navigateur. Le test voisin
// s'appuie sur un routeur en mémoire, qui n'a pas d'historique de navigateur du
// tout : un retour à `replaceState` le ferait échouer immédiatement.
//
// Volontairement rendue HORS du gabarit applicatif : afficher la barre latérale
// et ses écrans pendant une poignée de main d'authentification laisserait croire
// que l'application est ouverte alors qu'on ne sait pas encore qui entre.

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { seConnecter, terminerConnexion } from "../auth/oidc";

/** Où reprendre après connexion. Le planning est la vue centrale du produit. */
const APRES_CONNEXION = "/";

export default function AuthCallbackPage() {
  const nav = useNavigate();
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    let annule = false;
    // `terminerConnexion` est mémoïsé côté OIDC : le double montage de
    // StrictMode partage donc un seul échange, et ce second passage — dont la
    // fermeture n'est pas annulée — est celui qui navigue.
    terminerConnexion()
      .then(() => {
        if (!annule) nav(APRES_CONNEXION, { replace: true });
      })
      .catch((e: unknown) => {
        if (!annule) setErreur(e instanceof Error ? e.message : String(e));
      });
    return () => {
      annule = true;
    };
  }, [nav]);

  if (erreur !== null) {
    return (
      <div style={{ padding: 32, maxWidth: 640 }}>
        <h2>Connexion interrompue</h2>
        <p>
          L'échange avec le serveur d'authentification n'a pas abouti. C'est le plus souvent
          sans gravité : un lien de retour rejoué, un onglet resté ouvert trop longtemps, ou
          une page rechargée pendant la connexion — le code de retour ne sert qu'une fois.
        </p>
        <p className="muted">{erreur}</p>
        <button className="btn" onClick={() => void seConnecter()}>
          Se reconnecter
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: 32 }}>
      <p>Connexion en cours…</p>
    </div>
  );
}
