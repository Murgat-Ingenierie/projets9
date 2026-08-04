import type {
  BackupFile,
  Dependency,
  Epic,
  Equipe,
  Measure,
  Milestone,
  Project,
  TacheEquipe,
  Task,
  User,
} from "../types";
import { api } from "./client";

export const users = {
  list: () => api<User[]>("/api/users"),
  /** Liste réduite (id + nom) des comptes actifs, ouverte à tout membre.
   *  `list()` est réservée aux admins depuis C7 : les écrans qui ne font que
   *  proposer un responsable doivent utiliser celle-ci. */
  annuaire: () => api<{ id: number; nom: string }[]>("/api/users/annuaire"),
  me: () => api<User>("/api/users/me"),
  /** Crée un compte EN ATTENTE de première connexion : plus de mot de passe,
   *  Keycloak authentifie. L'email est ce qui rapprochera les deux. */
  create: (data: Partial<User> & { nom: string; email: string }) =>
    api<User>("/api/users", { method: "POST", body: JSON.stringify(data) }),
  update: (id: number, data: Partial<User>) =>
    api<User>(`/api/users/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  remove: (id: number) => api<void>(`/api/users/${id}`, { method: "DELETE" }),
};

export const epics = {
  list: () => api<Epic[]>("/api/epics"),
  get: (trigramme: string) => api<Epic>(`/api/epics/${trigramme}`),
  create: (data: Partial<Epic> & { trigramme: string; nom: string }) =>
    api<Epic>("/api/epics", { method: "POST", body: JSON.stringify(data) }),
  update: (trigramme: string, data: Partial<Epic>) =>
    api<Epic>(`/api/epics/${trigramme}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  remove: (trigramme: string) =>
    api<void>(`/api/epics/${trigramme}`, { method: "DELETE" }),
};

export const projects = {
  list: (epic?: string) =>
    api<Project[]>(`/api/projects${epic ? `?epic=${epic}` : ""}`),
  create: (data: Partial<Project>) =>
    api<Project>("/api/projects", { method: "POST", body: JSON.stringify(data) }),
  update: (id: number, data: Partial<Project>) =>
    api<Project>(`/api/projects/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  remove: (id: number) => api<void>(`/api/projects/${id}`, { method: "DELETE" }),
};

export const tasks = {
  list: (projet_id?: number) =>
    api<Task[]>(`/api/tasks${projet_id ? `?projet_id=${projet_id}` : ""}`),
  create: (data: Partial<Task>) =>
    api<Task>("/api/tasks", { method: "POST", body: JSON.stringify(data) }),
  update: (id: number, data: Partial<Task>) =>
    api<Task>(`/api/tasks/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  remove: (id: number) => api<void>(`/api/tasks/${id}`, { method: "DELETE" }),
};

export const milestones = {
  list: (params: { epic?: string } = {}) => {
    const q = new URLSearchParams();
    if (params.epic) q.set("epic", params.epic);
    const s = q.toString();
    return api<Milestone[]>(`/api/milestones${s ? `?${s}` : ""}`);
  },
  create: (data: Partial<Milestone>) =>
    api<Milestone>("/api/milestones", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (id: number, data: Partial<Milestone>) =>
    api<Milestone>(`/api/milestones/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  remove: (id: number) =>
    api<void>(`/api/milestones/${id}`, { method: "DELETE" }),
};

export const dependencies = {
  list: () => api<Dependency[]>("/api/dependencies"),
  create: (data: Partial<Dependency>) =>
    api<Dependency>("/api/dependencies", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  /** Seul le TYPE est modifiable : les extrémités sont fixées à la création.
   *  C'est ce qui dispense l'API de rejouer INV-14/INV-15, qui n'en dépendent
   *  que — cf. la docstring de `DependencyUpdate` côté serveur. */
  update: (id: number, type: Dependency["type"]) =>
    api<Dependency>(`/api/dependencies/${id}`, {
      method: "PUT",
      body: JSON.stringify({ type }),
    }),
  remove: (id: number) =>
    api<void>(`/api/dependencies/${id}`, { method: "DELETE" }),
};

export const measures = {
  list: (epic?: string) =>
    api<Measure[]>(`/api/measures${epic ? `?epic=${epic}` : ""}`),
  create: (data: Partial<Measure>) =>
    api<Measure>("/api/measures", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (id: number, data: Partial<Measure>) =>
    api<Measure>(`/api/measures/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  remove: (id: number) => api<void>(`/api/measures/${id}`, { method: "DELETE" }),
};

export const equipes = {
  list: () => api<Equipe[]>("/api/equipes"),
  get: (id: number) => api<Equipe>(`/api/equipes/${id}`),
  create: (data: { nom: string; temps_dispo_hebdo: number }) =>
    api<Equipe>("/api/equipes", { method: "POST", body: JSON.stringify(data) }),
  update: (id: number, data: Partial<{ nom: string; temps_dispo_hebdo: number }>) =>
    api<Equipe>(`/api/equipes/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  remove: (id: number) => api<void>(`/api/equipes/${id}`, { method: "DELETE" }),
};

export const tacheEquipe = {
  list: () => api<TacheEquipe[]>("/api/tache-equipe"),
  create: (data: { tache_id: number; equipe_id: number; heures_allouees: number }) =>
    api<TacheEquipe>("/api/tache-equipe", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (id: number, data: { heures_allouees: number }) =>
    api<TacheEquipe>(`/api/tache-equipe/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  remove: (id: number) =>
    api<void>(`/api/tache-equipe/${id}`, { method: "DELETE" }),
};

// Sauvegardes (SPEC §4, écran 11). Volontairement SANS téléchargement : un
// endpoint qui renverrait un dump serait un chemin d'exfiltration complet de la
// base. Le restore reste en ligne de commande (docs/RESTORE.md).
export const backups = {
  list: () => api<BackupFile[]>("/api/backups"),
  request: () =>
    api<{ demande: boolean; detail: string }>("/api/backups", { method: "POST" }),
};

// Import du classeur source (SPEC §4, écran Paramètres). Remplace le script CLI :
// celui-ci s'authentifiait sur le login maison, retiré avec Keycloak. On envoie
// le fichier depuis une page déjà authentifiée.
export interface RapportImport {
  utilisateurs_crees: number;
  projets_crees: number;
  projets_deja_presents: number;
  projets_non_planifies: number;
  taches_creees: number;
  taches_deja_presentes: number;
  taches_sans_projet: number;
  jalons: string;
  /** Lignes refusées par un invariant, avec leur motif. Le coeur du rapport. */
  refus: string[];
  totaux: Record<string, number>;
}

export const imports = {
  xlsx: (fichier: File) => {
    const corps = new FormData();
    corps.append("fichier", fichier);
    // Pas de Content-Type explicite : le navigateur doit poser lui-même la
    // frontière multipart. La fixer à la main casse l'envoi.
    return api<RapportImport>("/api/import/xlsx", { method: "POST", body: corps });
  },
};
