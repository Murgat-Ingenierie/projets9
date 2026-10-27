import type { Plugin } from "vite";

// Issue #137. La feuille complète de SVAR (`@svar-ui/react-gantt/all.css`)
// déclare ses polices — Roboto 400/500, Open Sans 400 à 700 — en
// `@font-face` pointant sur https://cdn.svar.dev/fonts/. La CSP du proxy
// (docker/proxy/default.conf.template) n'autorise que 'self' et
// fonts.gstatic.com en font-src : chaque chargement est refusé et la console
// se remplit de violations.
//
// On n'élargit PAS la CSP : le blocage du CDN SVAR est un choix assumé (C15,
// « aucune dépendance externe » de plus). On retire plutôt ces déclarations à
// la source, au moment où Vite lit la feuille, et gantt-svar.css aligne le thème
// sur le Roboto déjà servi par Google Fonts (index.html).
//
// Ce n'est pas qu'un bruit de console : la déclaration « Roboto » de SVAR, qui
// arrive APRÈS celle de Google Fonts pour les mêmes graisses (400, 500), entre
// en concurrence avec elle — selon les règles CSS Fonts, la dernière déclarée
// gagne, et son échec fait retomber le texte sur la police suivante de la pile.

// Feuilles minifiées : un bloc @font-face ne contient jamais d'accolade
// imbriquée, `[^}]*` suffit à le délimiter sans déborder sur la règle suivante.
const FONT_FACE_CDN_SVAR = /@font-face\s*\{[^}]*cdn\.svar\.dev[^}]*\}/g;

/** Retire les `@font-face` servis par le CDN SVAR ; le reste est intact. */
export function retirerPolicesCdnSvar(css: string): string {
  return css.replace(FONT_FACE_CDN_SVAR, "");
}

/** Plugin Vite appliquant `retirerPolicesCdnSvar` aux feuilles des paquets SVAR. */
export function policesSvarSansCdn(): Plugin {
  return {
    name: "polices-svar-sans-cdn",
    // `pre` : on reçoit la feuille brute, avant le pipeline CSS de Vite.
    enforce: "pre",
    transform(code, id) {
      // Feuilles CSS seulement : un import `?raw` (JS) n'est pas une feuille chargée.
      if (!/[\\/]@svar-ui[\\/].*\.css$/.test(id)) return null;
      const nettoye = retirerPolicesCdnSvar(code);
      return nettoye === code ? null : { code: nettoye, map: null };
    },
  };
}
