import { useEffect, useState } from "react";

/** Seuil unique des écrans étroits, partagé avec la feuille de style.
 *
 *  Défini ici ET dans `styles.css` : CSS et JavaScript ne peuvent pas partager
 *  une valeur, et faire lire le DOM à l'un pour l'autre coûterait plus cher que
 *  cette duplication. Les deux doivent bouger ensemble — c'est la largeur en
 *  dessous de laquelle une table à sept colonnes cesse d'être lisible. */
export const SEUIL_ETROIT = 720;

/** L'écran est-il sous le seuil ? Réactif : suit les rotations et les
 *  redimensionnements, sans écouter `resize` (qui se déclenche à chaque pixel). */
export function useEcranEtroit(): boolean {
  const [etroit, setEtroit] = useState(
    () => typeof window !== "undefined" && window.matchMedia(`(max-width: ${SEUIL_ETROIT}px)`).matches,
  );

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${SEUIL_ETROIT}px)`);
    const suivre = (e: MediaQueryListEvent) => setEtroit(e.matches);
    mq.addEventListener("change", suivre);
    // Relire à l'abonnement : entre le premier rendu et cet effet, la fenêtre a
    // pu changer de taille (rotation au chargement, ouverture d'un outil).
    setEtroit(mq.matches);
    return () => mq.removeEventListener("change", suivre);
  }, []);

  return etroit;
}
