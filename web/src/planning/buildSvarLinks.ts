import type { ILink } from "@svar-ui/react-gantt";
import type { Dependency, DependencyType } from "../types";
import { parseSvarId } from "./svarAdapter";

// Dépendances métier → liens SVAR. Les tâches sont identifiées "task:<id>" dans
// buildSvarTasks. FS = end-to-start, SS = start-to-start, FF = end-to-end.
// Un prédécesseur peut aussi être la FIN d'un projet (#141) : la flèche part
// alors de la barre "proj:<id>".
const LINK_TYPE: Record<DependencyType, ILink["type"]> = {
  FS: "e2s",
  SS: "s2s",
  FF: "e2e",
};

export function buildSvarLinks(deps: Dependency[]): ILink[] {
  return deps.map((d) => ({
    id: d.id,
    source: d.projet_amont_id != null ? `proj:${d.projet_amont_id}` : `task:${d.tache_amont_id}`,
    target: `task:${d.tache_aval_id}`,
    type: LINK_TYPE[d.type],
  }));
}

// Sens inverse : un lien dessiné dans SVAR → brouillon de dépendance métier.
// s2e (start-to-end, « SF ») n'a pas d'équivalent dans le domaine (FS/SS/FF).
const DEP_TYPE: Record<ILink["type"], DependencyType | null> = {
  e2s: "FS",
  s2s: "SS",
  e2e: "FF",
  s2e: null,
};

export type DependencyDraft =
  | { tache_amont_id: number; tache_aval_id: number; type: DependencyType }
  | { projet_amont_id: number; tache_aval_id: number; type: "FS" };

// Lien SVAR → dépendance à créer, ou null si non représentable dans le domaine :
// un aval qui n'est pas une tâche, un amont epic/jalon, un type SF — ou un projet
// amont relié autrement que par sa fin (seul FS a un sens, cf. #141).
// Inverse de buildSvarLinks — utilisé au dessin d'un lien (add-link).
export function svarLinkToDependency(
  link: Partial<Pick<ILink, "source" | "target" | "type">>,
): DependencyDraft | null {
  if (link.source == null || link.target == null || !link.type) return null;
  const src = parseSvarId(String(link.source));
  const tgt = parseSvarId(String(link.target));
  if (tgt?.kind !== "task") return null;
  const type = DEP_TYPE[link.type];
  if (!type) return null;
  if (src?.kind === "proj") {
    return type === "FS" ? { projet_amont_id: Number(src.ref), tache_aval_id: Number(tgt.ref), type } : null;
  }
  if (src?.kind !== "task") return null;
  return { tache_amont_id: Number(src.ref), tache_aval_id: Number(tgt.ref), type };
}
