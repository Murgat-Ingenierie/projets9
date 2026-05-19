export type UserRole = "admin" | "membre";
export type EpicStatus = "idee" | "actif" | "realise" | "abandonne";
export type EpicCategory = "operationnel" | "strategique" | "long_terme";
export type ProjectStatus = "prevu" | "en_cours" | "realise" | "abandonne";
export type TaskStatus = "prevu" | "en_cours" | "realise" | "abandonne";
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
  avancement: number;
  responsable_id: number | null;
  statut: TaskStatus;
  created_at: string;
  updated_at: string;
}

export interface Milestone {
  id: number;
  epic_trigramme: string | null;
  project_id: number | null;
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

export interface Measure {
  id: number;
  epic_trigramme: string;
  date: string;
  valeur: number;
  unite: string;
  commentaire: string | null;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface ApiError {
  detail:
    | string
    | {
        code: string;
        message: string;
      };
}
