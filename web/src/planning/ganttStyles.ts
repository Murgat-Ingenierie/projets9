// Couleurs et styles des barres du Gantt. Extrait de l'ancien GanttPage.tsx (C9, Phase 1 ; page retirée à la bascule SVAR).

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

// --- Lisibilité des libellés portés par les barres -------------------------

/** Luminance relative (WCAG 2.1 §1.4.3), 0 = noir, 1 = blanc. */
export function luminanceRelative(hex: string): number {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return 0; // couleur illisible : on suppose un fond sombre (défaut historique)
  const num = parseInt(m[1], 16);
  const canaux = [(num >> 16) & 0xff, (num >> 8) & 0xff, num & 0xff].map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * canaux[0] + 0.7152 * canaux[1] + 0.0722 * canaux[2];
}

/** Rapport de contraste WCAG entre deux luminances (1 = identique, 21 = max). */
function rapportContraste(a: number, b: number): number {
  const [haut, bas] = a > b ? [a, b] : [b, a];
  return (haut + 0.05) / (bas + 0.05);
}

/** Couleur de libellé offrant le MEILLEUR contraste sur ce fond.
 *
 *  Le libellé était blanc quel que soit le fond. Or les tâches portent la couleur
 *  de leur epic ÉCLAIRCIE (facteur 1.6) : sur un epic déjà pâle, le blanc devenait
 *  illisible. Le défaut se révélait à la sélection, qui assombrit la barre — d'où
 *  un texte qui n'apparaissait qu'une fois cliqué.
 *
 *  On COMPARE les deux rapports plutôt que de trancher sur un seuil de luminance.
 *  Un seuil « milieu de gamme » (0,5) se trompe : le point d'équilibre réel est
 *  vers 0,18, le blanc perdant l'avantage bien plus tôt que l'intuition ne le
 *  suggère. Sur l'orange éclairci du signalement (luminance 0,51), le blanc offre
 *  un rapport de 1,9 quand le gris sombre en donne 8,0 — un seuil à 0,5 aurait
 *  laissé le texte illisible.
 */
export function couleurTexteSur(fond: string): string {
  const l = luminanceRelative(fond);
  const surClair = rapportContraste(l, luminanceRelative(TEXTE_SUR_FOND_CLAIR));
  const surBlanc = rapportContraste(l, 1);
  return surClair > surBlanc ? TEXTE_SUR_FOND_CLAIR : "#ffffff";
}

/** Gris très sombre plutôt que noir pur : moins dur à lire sur une pastille de
 *  couleur, et cohérent avec le texte de l'application. */
export const TEXTE_SUR_FOND_CLAIR = "#1f2937";
