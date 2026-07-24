import type { ILink } from "@svar-ui/react-gantt";
import type { Dependency, DependencyType } from "../types";

// Dépendances métier → liens SVAR. Les tâches sont identifiées "task:<id>" dans
// buildSvarTasks. FS = end-to-start, SS = start-to-start, FF = end-to-end.
const LINK_TYPE: Record<DependencyType, ILink["type"]> = {
  FS: "e2s",
  SS: "s2s",
  FF: "e2e",
};

export function buildSvarLinks(deps: Dependency[]): ILink[] {
  return deps.map((d) => ({
    id: d.id,
    source: `task:${d.tache_amont_id}`,
    target: `task:${d.tache_aval_id}`,
    type: LINK_TYPE[d.type],
  }));
}
