// Jeu de données déterministe pour les e2e du planning (dates autour de
// « aujourd'hui » pour être dans la fenêtre par défaut du Gantt). Mêmes formes
// que l'API réelle (cf. web/src/types).
import type {
  Epic,
  Project,
  Task,
  Milestone,
  Dependency,
  Equipe,
  TacheEquipe,
  User,
} from "../src/types";

export const ADMIN: User = {
  id: 1, nom: "Admin Test", email: "admin@test.local",
  role: "admin", actif: true, created_at: "", updated_at: "",
};

/** Annuaire réduit — ce que `users.annuaire()` renvoie, et ce qui peuple le
 *  sélecteur de responsable. Deux personnes suffisent : une qui porte des lignes,
 *  une qui n'en porte aucune, pour distinguer « filtre vide » de « filtre cassé ». */
export const ANNUAIRE = [
  { id: 1, nom: "Admin Test" },
  { id: 2, nom: "Mathieu Pourbaix" },
];

export const EPICS: Epic[] = [
  {
    trigramme: "O50", nom: "Optimisation bassins", critere_reussite: null,
    raison_date_fin: null, date_fin_prevue: null, jalon_fin_max: null,
    statut: "actif", categorie: "operationnel", couleur: "#2563eb",
    created_at: "", updated_at: "",
  },
];

export const PROJECTS: Project[] = [
  { id: 1, epic_trigramme: "O50", nom: "Capteurs O2", description: null, date_debut: "2026-07-06", date_fin: "2026-09-15", statut: "en_cours", responsable_id: null, created_at: "", updated_at: "" },
  { id: 2, epic_trigramme: "O50", nom: "Regulation flux", description: null, date_debut: "2026-08-10", date_fin: "2026-10-30", statut: "prevu", responsable_id: null, created_at: "", updated_at: "" },
];

export const TASKS: Task[] = [
  { id: 11, projet_id: 1, nom: "Choix capteurs", date_debut: "2026-07-06", date_fin: "2026-07-24", responsable_id: null, statut: "archive", created_at: "", updated_at: "" },
  { id: 12, projet_id: 1, nom: "Pose et calibration", date_debut: "2026-07-27", date_fin: "2026-09-15", responsable_id: null, statut: "ouvert", created_at: "", updated_at: "" },
  { id: 13, projet_id: 2, nom: "Etude debit", date_debut: "2026-08-10", date_fin: "2026-09-20", responsable_id: null, statut: "ouvert", created_at: "", updated_at: "" },
];

export const MILESTONES: Milestone[] = [
  { id: 21, project_ids: [1], nom: "Bassin pilote equipe", date: "2026-09-15", atteint: false, created_at: "", updated_at: "" },
];

export const DEPENDENCIES: Dependency[] = [
  { id: 101, tache_amont_id: 12, tache_aval_id: 13, type: "FS" },
];

export const EQUIPES: Equipe[] = [
  { id: 1, nom: "Equipe A", temps_dispo_hebdo: 35, created_at: "", updated_at: "" },
  { id: 2, nom: "Equipe B", temps_dispo_hebdo: 35, created_at: "", updated_at: "" },
];

// Tâche 11 (projet 1) → Equipe A ; tâche 13 (projet 2) → Equipe B. Permet de tester
// le filtre équipe et sa sémantique d'UNION (A ∪ B révèle les deux projets).
export const TACHE_EQUIPE: TacheEquipe[] = [
  { id: 1, tache_id: 11, equipe_id: 1, heures_allouees: 10 },
  { id: 2, tache_id: 13, equipe_id: 2, heures_allouees: 8 },
];
