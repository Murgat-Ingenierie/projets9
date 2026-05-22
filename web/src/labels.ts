import type { EpicCategory, EpicStatus, ProjectStatus, TaskStatus, UserRole } from "./types";

export const EPIC_STATUS_LABELS: Record<EpicStatus, string> = {
  idee: "Idée",
  actif: "Actif",
  realise: "Réalisé",
  abandonne: "Abandonné",
};

export const EPIC_CATEGORY_LABELS: Record<EpicCategory, string> = {
  operationnel: "Opérationnel",
  strategique: "Stratégique",
  long_terme: "Long terme",
};

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  prevu: "Prévu",
  en_cours: "En cours",
  realise: "Réalisé",
  abandonne: "Abandonné",
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  ouvert: "Ouverte",
  archive: "Archivée",
};

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  admin: "Administrateur",
  membre: "Membre",
};

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}
