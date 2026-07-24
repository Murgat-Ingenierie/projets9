// Adaptateur d'ids entre le domaine et les tâches SVAR. Les lignes SVAR sont
// identifiées "epic:<tri>", "proj:<id>", "task:<id>", "ms:<id>" (cf. buildSvarTasks) ;
// ce module retrouve le type et la référence pour router les mutations (drag).
// C9 Phase 2b.

export type SvarRowKind = "epic" | "proj" | "task" | "ms";

export interface ParsedSvarId {
  kind: SvarRowKind;
  /** Référence brute après le préfixe : id numérique (proj/task/ms) ou trigramme (epic). */
  ref: string;
}

export function parseSvarId(id: string): ParsedSvarId | null {
  const i = id.indexOf(":");
  if (i < 0) return null;
  const kind = id.slice(0, i);
  const ref = id.slice(i + 1);
  if (!ref) return null;
  if (kind === "epic" || kind === "proj" || kind === "task" || kind === "ms") {
    return { kind, ref };
  }
  return null;
}
