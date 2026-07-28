import { useMemo } from "react";

// Stabilise l'IDENTITÉ d'une liste tant que son CONTENU ne change pas.
//
// Pourquoi : le wrapper React de SVAR ré-initialise TOUT le store dès que la prop
// `tasks` (ou `links`) change de référence — cf. son effet
// `c.current ? I.init(m) : B && B(b)`, avec `m` mémoïsé sur les props. Or
// `usePlanningData.reload()` est appelé après CHAQUE mutation et refait les 7
// requêtes : même quand rien n'a bougé (créer un lien ne modifie aucune tâche), on
// obtient de nouveaux tableaux → nouvelle référence → ré-init complet → clignotement.
//
// En comparant le contenu sérialisé, une recharge qui ne change rien renvoie la
// référence PRÉCÉDENTE : SVAR ne voit aucun changement de prop, donc ne ré-init pas.

/** Signature de contenu (les listes SVAR sont des objets sérialisables : id, text, dates…). */
export function listSignature(list: unknown[]): string {
  return JSON.stringify(list);
}

export function useStableList<T>(list: T[]): T[] {
  const signature = useMemo(() => listSignature(list), [list]);
  // Clé volontairement réduite à la signature : on veut précisément IGNORER un
  // changement de référence à contenu identique. `list` est donc hors deps.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => list, [signature]);
}
