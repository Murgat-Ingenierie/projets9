export type UserRole = "admin" | "membre";
export type EpicStatus = "idee" | "actif" | "realise" | "abandonne";
export type EpicCategory = "operationnel" | "strategique" | "long_terme";
export type ProjectStatus = "prevu" | "en_cours" | "realise" | "abandonne";
export type TaskStatus = "ouvert" | "archive";
export type DependencyType = "FS" | "SS" | "FF";

export interface User {
  id: number;
  nom: string;
  email: string;
  role: UserRole;
  actif: boolean;
  created_at: string;
  updated_at: string;
}

export interface Epic {
  trigramme: string;
  nom: string;
  critere_reussite: string | null;
  raison_date_fin: string | null;
  date_fin_prevue: string | null;
  jalon_fin_max: string | null;
  statut: EpicStatus;
  categorie: EpicCategory;
  couleur: string | null;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: number;
  epic_trigramme: string;
  nom: string;
  description: string | null;
  date_debut: string;
  date_fin: string;
  statut: ProjectStatus;
  responsable_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: number;
  projet_id: number;
  nom: string;
  date_debut: string;
  date_fin: string;
  responsable_id: number | null;
  statut: TaskStatus;
  created_at: string;
  updated_at: string;
}

export interface Milestone {
  id: number;
  project_ids: number[];
  nom: string;
  date: string;
  atteint: boolean;
  created_at: string;
  updated_at: string;
}

export interface Dependency {
  id: number;
  tache_amont_id: number;
  tache_aval_id: number;
  type: DependencyType;
}

/** Point de contrôle dans une tâche. PAS une sous-tâche : ni dates, ni
 *  responsable, ni dépendances — rien qui pèse sur le planning ou la charge. */
export interface TaskTodo {
  id: number;
  tache_id: number;
  libelle: string;
  fait: boolean;
  created_at: string;
  updated_at: string;
}

/** Entrée de journal sur une tâche. IMMUABLE : aucune route ne la modifie —
 *  c'est ce qui en fait une trace plutôt qu'une note. `auteur_nom` est une copie
 *  du nom au moment de l'écriture : un journal dit qui a écrit, à cette date-là. */
export interface TaskActivite {
  id: number;
  tache_id: number;
  texte: string;
  auteur_id: number | null;
  auteur_nom: string;
  created_at: string;
  updated_at: string;
}

export interface Measure {
  id: number;
  epic_trigramme: string;
  date: string;
  valeur: number;
  unite: string;
  commentaire: string | null;
}

export interface Equipe {
  id: number;
  nom: string;
  temps_dispo_hebdo: number;
  created_at: string;
  updated_at: string;
}

export interface TacheEquipe {
  id: number;
  tache_id: number;
  equipe_id: number;
  heures_allouees: number;
}

export interface ApiError {
  detail:
    | string
    | {
        code: string;
        message: string;
      };
}

/** Sauvegarde présente dans le volume de dumps (SPEC §4, écran 11). */
export interface BackupFile {
  nom: string;
  taille_octets: number;
  /** ISO-8601 UTC. */
  date: string;
}
