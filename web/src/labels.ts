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

/** Nom de champ de l'API → intitulé affiché à l'écran.
 *
 *  Sert à rendre les erreurs de validation compréhensibles : un utilisateur voit
 *  « Epic », pas `epic_trigramme`. Les champs absents de cette table retombent sur
 *  leur nom brut — dégradé lisible plutôt qu'un vide trompeur. */
export const FIELD_LABELS: Record<string, string> = {
  epic_trigramme: "Epic",
  trigramme: "Trigramme",
  nom: "Nom",
  description: "Description",
  date_debut: "Date de début",
  date_fin: "Date de fin",
  date: "Date",
  responsable_id: "Responsable",
  statut: "Statut",
  categorie: "Catégorie",
  couleur: "Couleur",
  projet_id: "Projet",
  project_ids: "Projets rattachés",
  email: "Adresse e-mail",
  role: "Rôle",
  temps_dispo_hebdo: "Temps disponible hebdomadaire",
  heures: "Heures",
  unite: "Unité",
  valeur: "Valeur",
  tache_amont_id: "Tâche amont",
  tache_aval_id: "Tâche aval",
  type: "Type",
};

export const EPIC_STATUTS: EpicStatus[] = ["idee", "actif", "realise", "abandonne"];
export const EPIC_CATEGORIES: EpicCategory[] = ["operationnel", "strategique", "long_terme"];
export const PROJECT_STATUTS: ProjectStatus[] = ["prevu", "en_cours", "realise", "abandonne"];
export const TASK_STATUTS: TaskStatus[] = ["ouvert", "archive"];
export const USER_ROLES: UserRole[] = ["admin", "membre"];

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}
