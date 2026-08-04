// Échéances portées par les jalons — « un projet ne peut pas finir APRÈS son jalon ».
//
// Cette règle N'EST PAS un invariant : l'API ne la fait pas respecter, et les
// données réelles la violent (4 rattachements sur 13 au 2026-08-03). Elle est
// donc SIGNALÉE, pas imposée — le planning montre le dépassement, il ne l'empêche
// pas. Si le besoin est confirmé, sa place sera dans app/invariants, à côté
// d'INV-10 qui borne déjà un projet par l'échéance de son epic.
//
// Tout se calcule à partir des DATES, en proportion de la barre. Aucune mesure
// dans le DOM : c'est ce qui distingue cette approche des traits qu'on a essayés
// avant, et ce qui la garde compatible avec l'architecture issue de C9.

import { daysBetweenIso } from "./dates";
import type { Milestone } from "../types";

export interface Depassement {
  /** Nom du jalon dépassé — celui qui contraint, cf. `echeanceLaPlusProche`. */
  jalon: string;
  /** Date de l'échéance (ISO). */
  date: string;
  /** Jours de retard, toujours > 0 (sinon il n'y a pas de dépassement). */
  jours: number;
  /** Position de l'échéance sur la barre, de 0 (début) à 1 (fin). */
  ratio: number;
}

/** Échéance la plus PROCHE parmi les jalons d'un projet.
 *
 *  Un projet peut porter plusieurs jalons ; la contrainte effective est la plus
 *  précoce — la respecter satisfait les autres. En afficher plusieurs
 *  encombrerait la barre sans rien apprendre de plus.
 */
export function echeanceLaPlusProche(
  projetId: number,
  milestones: Milestone[],
): { date: string; nom: string } | null {
  let meilleure: { date: string; nom: string } | null = null;
  for (const m of milestones) {
    if (!(m.project_ids ?? []).includes(projetId)) continue;
    if (meilleure === null || m.date < meilleure.date) meilleure = { date: m.date, nom: m.nom };
  }
  return meilleure;
}

/** Dépassement d'un projet sur son échéance, ou null s'il la respecte.
 *
 *  `ratio` borné à [0, 1] : une échéance antérieure au DÉBUT du projet donne 0,
 *  soit une barre entièrement en dépassement — ce qui est exact, le projet est
 *  en retard sur toute sa durée.
 */
export function calculerDepassement(
  dateDebut: string,
  dateFin: string,
  echeance: { date: string; nom: string } | null,
): Depassement | null {
  if (!echeance) return null;
  const jours = daysBetweenIso(echeance.date, dateFin);
  if (jours <= 0) return null; // le projet finit avant (ou pile) : rien à signaler

  const duree = daysBetweenIso(dateDebut, dateFin);
  // Un projet d'un seul jour qui dépasse : tout est en retard, sans division par zéro.
  const ratio = duree <= 0 ? 0 : Math.min(1, Math.max(0, daysBetweenIso(dateDebut, echeance.date) / duree));
  return { jalon: echeance.nom, date: echeance.date, jours, ratio };
}

// --- Repérage des dates de jalon sur l'échelle de temps --------------------

/** Une cellule de l'échelle couvre-t-elle l'une de ces dates ?
 *
 *  `highlightTime` de SVAR reçoit le DÉBUT d'une cellule, dont la largeur dépend
 *  du zoom : un jour, sept jours, ou un mois. Comparer la date exacte ne
 *  fonctionne donc qu'en vue Jour — c'est d'ailleurs pourquoi la colonne
 *  « aujourd'hui » n'apparaissait pas en vue Mois. On compare ici sur la PORTÉE
 *  réelle de la cellule.
 *
 *  `pasJours` : largeur en jours, ou null pour une cellule d'un mois calendaire
 *  (durée variable — 28 à 31 jours — d'où le traitement à part).
 */
export function celluleCouvre(
  debutCellule: Date,
  pasJours: number | null,
  dates: ReadonlySet<string>,
): boolean {
  if (dates.size === 0) return false;
  const fin = new Date(debutCellule);
  if (pasJours === null) fin.setMonth(fin.getMonth() + 1);
  else fin.setDate(fin.getDate() + pasJours);
  for (const iso of dates) {
    const d = new Date(`${iso}T00:00:00`);
    if (d >= debutCellule && d < fin) return true;
  }
  return false;
}
