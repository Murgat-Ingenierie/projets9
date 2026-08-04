// Dépendances qu'un filtre équipe empêche de dessiner.
//
// Le planning ne trace un lien que si ses DEUX extrémités sont visibles (cf.
// `svarLinksRaw` dans GanttSvarPage) : un lien pendant ne veut rien dire, et une
// cascade vers une tâche hors périmètre déplacerait ce que l'utilisateur ne voit
// pas. Le choix reste bon, mais il a un coût que personne ne voyait — une tâche
// dont toutes les dépendances pointent hors filtre paraît indépendante, alors
// qu'elle ne l'est pas. C'est ce que remonte l'utilisateur test.
//
// Ce module ne dit donc pas « cette tâche a des dépendances » (les flèches le
// disent déjà quand elles sont dessinées), mais « cette tâche a des dépendances
// que le filtre courant CACHE ». Sans filtre, il ne signale rien.

import type { Dependency, DependencyType } from "../types";

/** Un lien existant dont l'autre extrémité est hors du périmètre affiché. */
export interface LienMasque {
  /** Vu depuis la tâche visible : `amont` = elle dépend de l'autre. */
  sens: "amont" | "aval";
  nomAutre: string;
  type: DependencyType;
}

const SENS_LABEL: Record<LienMasque["sens"], string> = {
  amont: "Dépend de",
  aval: "Précède",
};

/**
 * Pour chaque tâche du périmètre, les dépendances dont l'autre bout est masqué.
 *
 * `visibles` à `null` signifie « pas de filtre » : rien n'est masqué, la table
 * revient vide. Une dépendance dont les DEUX bouts sont hors périmètre ne
 * concerne aucune ligne affichée, elle est donc ignorée.
 */
export function liensMasquesParTache(
  dependencies: readonly Dependency[],
  nomParTacheId: ReadonlyMap<number, string>,
  visibles: ReadonlySet<number> | null,
): Map<number, LienMasque[]> {
  const out = new Map<number, LienMasque[]>();
  if (!visibles) return out;

  const ajouter = (tacheId: number, lien: LienMasque) => {
    const liste = out.get(tacheId);
    if (liste) liste.push(lien);
    else out.set(tacheId, [lien]);
  };

  for (const d of dependencies) {
    const amontVisible = visibles.has(d.tache_amont_id);
    const avalVisible = visibles.has(d.tache_aval_id);
    // Les deux visibles : la flèche est dessinée, rien à signaler.
    // Les deux masqués : le lien ne touche aucune ligne affichée.
    if (amontVisible === avalVisible) continue;

    if (avalVisible) {
      ajouter(d.tache_aval_id, {
        sens: "amont",
        nomAutre: nomParTacheId.get(d.tache_amont_id) ?? `tâche ${d.tache_amont_id}`,
        type: d.type,
      });
    } else {
      ajouter(d.tache_amont_id, {
        sens: "aval",
        nomAutre: nomParTacheId.get(d.tache_aval_id) ?? `tâche ${d.tache_aval_id}`,
        type: d.type,
      });
    }
  }
  return out;
}

/**
 * Infobulle de la marque. Nomme chaque lien caché : savoir qu'il en existe ne
 * sert à rien si l'on ne peut pas dire lesquels sans retirer le filtre.
 */
export function infobulleLiensMasques(liens: readonly LienMasque[]): string {
  const entete =
    liens.length === 1
      ? "1 dépendance masquée par le filtre équipe :"
      : `${liens.length} dépendances masquées par le filtre équipe :`;
  const lignes = liens.map((l) => `• ${SENS_LABEL[l.sens]} « ${l.nomAutre} » (${l.type})`);
  return [entete, ...lignes].join("\n");
}
