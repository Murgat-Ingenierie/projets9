// Helpers de dates du planning — purs, sans dépendance à la lib Gantt.
// Les dates métier sont des chaînes ISO "YYYY-MM-DD" ancrées à minuit LOCAL
// (cohérent avec l'API et l'affichage). Extrait de l'ancien GanttPage.tsx (C9, Phase 1 ; page retirée à la bascule SVAR).

export function toDate(iso: string): Date {
  return new Date(iso + "T00:00:00");
}

export function isoDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function fmtDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

const DAY_MS = 86_400_000;

// Décale une date ISO de `deltaDays` jours calendaires (peut être négatif),
// en gérant les bords de mois/année et l'heure d'été via l'API Date native.
export function shiftIso(iso: string, deltaDays: number): string {
  const d = toDate(iso);
  d.setDate(d.getDate() + deltaDays);
  return isoDate(d);
}

// Nombre de jours calendaires entre deux dates ISO (toIso - fromIso).
export function daysBetweenIso(fromIso: string, toIso: string): number {
  return Math.round((toDate(toIso).getTime() - toDate(fromIso).getTime()) / DAY_MS);
}
