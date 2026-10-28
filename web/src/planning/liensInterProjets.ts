// Dépendances INTER-PROJETS sur le planning (#143).
//
// Deux défauts remontés par l'utilisateur :
// 1. SVAR ne trace un lien que si ses deux extrémités sont des lignes AFFICHÉES.
//    Or les projets sont repliés par défaut : une dépendance entre la tâche d'un
//    projet et celle d'un autre est donc invisible tant qu'on n'a pas déplié les
//    deux — c'est précisément le lien qu'on a le plus besoin de voir, puisqu'il
//    engage deux projets.
// 2. Une fois dessinée, rien ne la distingue d'une dépendance interne.
//
// Réponse : (a) un style propre, toujours appliqué, pour les liens dont les deux
// bouts sont dans des projets différents ; (b) une COUCHE activable qui reporte
// ces liens sur les barres de PROJET, toujours affichées. Activable et non
// permanente : sur un planning chargé, une flèche par paire de projets en plus
// des flèches de tâches surchargerait la vue — c'est la réserve de l'utilisateur.

import type { ILink } from "@svar-ui/react-gantt";
import type { Dependency, DependencyType } from "../types";

/** Préfixe des liens de la couche : ils ne correspondent à AUCUNE dépendance en
 *  base (un même lien agrège plusieurs dépendances), donc ni suppression ni
 *  édition — cf. l'interception de `delete-link` dans GanttSvarPage. */
export const PREFIXE_LIEN_COUCHE = "xp:";

const LINK_TYPE: Record<DependencyType, ILink["type"]> = { FS: "e2s", SS: "s2s", FF: "e2e" };

/** Projet de chacun des deux bouts, ou null si l'un est inconnu (tâche absente
 *  des données chargées : on ne sait rien en dire, on ne classe pas). */
function projetsDesBouts(
  d: Dependency,
  projetParTacheId: ReadonlyMap<number, number>,
): { amont: number; aval: number } | null {
  // Un prédécesseur « fin de projet » (#141) est son propre projet.
  const amont = d.projet_amont_id ?? (d.tache_amont_id != null ? projetParTacheId.get(d.tache_amont_id) : undefined);
  const aval = projetParTacheId.get(d.tache_aval_id);
  return amont != null && aval != null ? { amont, aval } : null;
}

/** Ids des dépendances dont les deux bouts appartiennent à des projets différents. */
export function idsInterProjets(
  dependencies: readonly Dependency[],
  projetParTacheId: ReadonlyMap<number, number>,
): number[] {
  return dependencies
    .filter((d) => {
      const p = projetsDesBouts(d, projetParTacheId);
      return p != null && p.amont !== p.aval;
    })
    .map((d) => d.id);
}

/**
 * La couche : un lien de barre de projet à barre de projet par paire
 * (projet amont, projet aval, type). Plusieurs dépendances entre les deux mêmes
 * projets n'en donnent qu'un — la couche dit « ces projets sont liés », le
 * détail tâche par tâche reste aux flèches de tâches, visibles en dépliant.
 *
 * Le type est conservé (et entre dans la clé) : ramener un SS à une flèche
 * fin → début affirmerait une contrainte qui n'existe pas.
 *
 * `projetsVisibles` à `null` = pas de filtre. Sinon, comme pour les liens de
 * tâches, on ne trace rien vers une ligne absente.
 */
export function liensCoucheInterProjets(
  dependencies: readonly Dependency[],
  projetParTacheId: ReadonlyMap<number, number>,
  projetsVisibles: ReadonlySet<number> | null,
): ILink[] {
  const out = new Map<string, ILink>();
  for (const d of dependencies) {
    const p = projetsDesBouts(d, projetParTacheId);
    if (!p || p.amont === p.aval) continue;
    if (projetsVisibles && !(projetsVisibles.has(p.amont) && projetsVisibles.has(p.aval))) continue;
    const id = `${PREFIXE_LIEN_COUCHE}${p.amont}-${p.aval}-${d.type}`;
    if (!out.has(id)) {
      out.set(id, { id, source: `proj:${p.amont}`, target: `proj:${p.aval}`, type: LINK_TYPE[d.type] });
    }
  }
  return [...out.values()];
}

/**
 * Règle CSS qui distingue les liens inter-projets (pointillé + couleur dédiée).
 *
 * Par une règle engendrée depuis les données, comme le nom barré des lignes
 * terminées : SVAR rend lui-même ses flèches et n'accepte pas de classe par
 * lien, mais pose sur chacune un `data-link-id` — l'id tel quel pour un nombre,
 * préfixé de « : » pour une chaîne (`setID` de @svar-ui/lib-dom).
 *
 * Seuls des ids de forme connue entrent dans le sélecteur : aucun caractère
 * venu des données ne s'y retrouve.
 */
export function styleLiensInterProjets(ids: readonly (number | string)[]): string | null {
  const attributs = ids
    .map((id) => (typeof id === "number" ? String(id) : `:${id}`))
    .filter((a) => /^(\d+|:xp:\d+-\d+-(FS|SS|FF))$/.test(a));
  if (attributs.length === 0) return null;
  const selecteurs = attributs.map((a) => `.svar-planning [data-link-id="${a}"] .wx-line-draw`).join(",");
  return `${selecteurs}{stroke:var(--lien-inter-projets);stroke-dasharray:6 4}`;
}
