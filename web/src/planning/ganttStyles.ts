// Couleurs et styles des barres du Gantt. Extrait de GanttPage.tsx (C9, Phase 1).

export const DEFAULT_EPIC_COLOR = "#3f51b5";

// Éclaircit (factor > 1) ou assombrit (factor < 1) une couleur hex #RRGGBB.
// Renvoie l'entrée telle quelle si ce n'est pas un hex à 6 chiffres.
export function adjustBrightness(hex: string, factor: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const num = parseInt(m[1], 16);
  const channels = [(num >> 16) & 0xff, (num >> 8) & 0xff, num & 0xff].map((c) => {
    if (factor < 1) return Math.round(c * factor);
    return Math.round(c + (255 - c) * (1 - 1 / factor));
  });
  return `#${channels.map((x) => Math.max(0, Math.min(255, x)).toString(16).padStart(2, "0")).join("")}`;
}

export function stylesFor(color: string) {
  return {
    backgroundColor: color,
    backgroundSelectedColor: adjustBrightness(color, 0.8),
    progressColor: color,
    progressSelectedColor: adjustBrightness(color, 0.8),
  };
}
