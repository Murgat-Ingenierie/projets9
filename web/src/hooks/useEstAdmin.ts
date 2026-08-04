import { useAuth } from "../auth";

/** Vrai si l'utilisateur courant est administrateur.
 *
 *  Les neuf endpoints `DELETE` de l'API exigent `require_admin` depuis C7. Ce
 *  hook sert à ne pas PROPOSER ce qu'on refusera ensuite — cf. `BoutonSupprimer`,
 *  qui le porte pour le cas courant, et les suppressions rendues par une
 *  bibliothèque (la corbeille d'un lien dans le planning) qui ne peuvent pas
 *  passer par lui.
 *
 *  ⚠️ Confort d'interface, PAS une protection : ce qui garde les données, ce
 *  sont les `require_admin` côté API. Masquer un bouton n'empêche personne
 *  d'appeler l'endpoint.
 *
 *  Fichier à part pour que `BoutonSupprimer.tsx` n'exporte qu'un composant — un
 *  module qui mêle les deux casse le rechargement à chaud.
 */
export function useEstAdmin(): boolean {
  const { user } = useAuth();
  return user?.role === "admin";
}
