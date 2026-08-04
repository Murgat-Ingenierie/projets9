// Tâche débordant la fenêtre de son projet (ex-INV-9).
//
// L'invariant a été SUPPRIMÉ le 2026-07-17 : une tâche peut désormais sortir des
// dates de son projet, et l'API ne refuse plus la mutation. Le parti pris était
// « le planning signale, l'API ne bloque que l'incohérence structurelle » — sauf
// que la moitié « le planning signale » a disparu avec la bascule SVAR (C9), sans
// que personne ne s'en aperçoive. La situation n'était donc ni refusée ni
// signalée, ce que la SPEC a fini par admettre le 2026-08-04.
//
// Ce module rétablit le signal. Comme pour les dépassements de jalon, tout se
// calcule en PROPORTION de la barre à partir des dates : aucune mesure dans le
// DOM, donc rien à recalculer au zoom ni au redimensionnement de la fenêtre.

import { daysBetweenIso } from "./dates";

/** Portions de la barre situées hors de la fenêtre du projet, en proportion. */
export interface HorsFenetre {
  /** Largeur de la portion ANTÉRIEURE au début du projet, de 0 à 1. */
  avant: number;
  /** Largeur de la portion POSTÉRIEURE à la fin du projet, de 0 à 1. */
  apres: number;
  /** Jours hors fenêtre (avant + après), pour l'infobulle. */
  jours: number;
  /** Fenêtre du projet, telle qu'annoncée à l'utilisateur. */
  projetDebut: string;
  projetFin: string;
}

/**
 * Débordement d'une tâche sur la fenêtre de son projet, ou null si elle y tient.
 *
 * Les deux côtés sont rendus séparément : une tâche peut commencer trop tôt,
 * finir trop tard, ou les deux. Hachurer la barre entière dirait « quelque chose
 * ne va pas » sans dire quoi ; hachurer les portions fautives montre de quel côté
 * et de combien.
 */
export function calculerHorsFenetre(
  tacheDebut: string,
  tacheFin: string,
  projetDebut: string | null | undefined,
  projetFin: string | null | undefined,
): HorsFenetre | null {
  if (!projetDebut || !projetFin) return null;

  const joursAvant = Math.max(0, daysBetweenIso(tacheDebut, projetDebut));
  const joursApres = Math.max(0, daysBetweenIso(projetFin, tacheFin));
  if (joursAvant === 0 && joursApres === 0) return null;

  const duree = daysBetweenIso(tacheDebut, tacheFin);
  // Tâche d'un seul jour hors fenêtre : toute la barre déborde, et l'on évite la
  // division par zéro. Le côté choisi est celui qui porte le débordement.
  if (duree <= 0) {
    return {
      avant: joursAvant > 0 ? 1 : 0,
      apres: joursAvant > 0 ? 0 : 1,
      jours: joursAvant + joursApres,
      projetDebut,
      projetFin,
    };
  }

  // Bornés puis rognés l'un par l'autre : une tâche ENTIÈREMENT hors fenêtre peut
  // sinon produire deux portions dont la somme dépasse la barre.
  const avant = Math.min(1, joursAvant / duree);
  const apres = Math.min(1 - avant, joursApres / duree);
  return { avant, apres, jours: joursAvant + joursApres, projetDebut, projetFin };
}

/** Infobulle : de quel côté, de combien, et par rapport à quoi. */
export function infobulleHorsFenetre(h: HorsFenetre, nomProjet: string): string {
  const cotes: string[] = [];
  if (h.avant > 0) cotes.push("commence avant");
  if (h.apres > 0) cotes.push("finit après");
  const jour = h.jours === 1 ? "jour" : "jours";
  return (
    `Sort de la fenêtre du projet « ${nomProjet} » (${h.projetDebut} → ${h.projetFin}) : ` +
    `${cotes.join(" et ")}, ${h.jours} ${jour} au total.`
  );
}
