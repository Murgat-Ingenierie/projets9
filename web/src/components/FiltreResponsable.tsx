// Filtre « Responsable » des listes Projets et Tâches.
//
// Retour d'usage. La recherche libre trouve déjà un nom de responsable, mais elle
// se tape de mémoire : une faute de frappe ne rend rien, et surtout elle ne dit
// pas QUI existe. Un sélecteur montre l'annuaire et ne se trompe pas.
//
// Il vaut aussi pour les écrans étroits, où les filtres par colonne disparaissent
// avec l'en-tête du tableau.

import { useId } from "react";

/** Valeur du sélecteur : `""` = tous, `"aucun"` = sans responsable, sinon un id. */
export type ValeurResponsable = "" | "aucun" | `${number}`;

/** Prédicat correspondant, à passer à `useSortableList`.
 *
 *  Renvoie `undefined` quand aucun filtre n'est actif : le hook saute alors
 *  l'étape au lieu de parcourir la liste pour tout garder.
 */
export function predicatResponsable<T extends { responsable_id?: number | null }>(
  valeur: ValeurResponsable,
): ((item: T) => boolean) | undefined {
  if (valeur === "") return undefined;
  if (valeur === "aucun") return (item) => item.responsable_id == null;
  const id = Number(valeur);
  return (item) => item.responsable_id === id;
}

interface Props {
  valeur: ValeurResponsable;
  onChange: (v: ValeurResponsable) => void;
  utilisateurs: { id: number; nom: string }[];
}

export function FiltreResponsable({ valeur, onChange, utilisateurs }: Props) {
  const id = useId();
  return (
    <span className="filtre-responsable">
      <label htmlFor={id}>Responsable</label>
      <select id={id} value={valeur} onChange={(e) => onChange(e.target.value as ValeurResponsable)}>
        <option value="">Tous</option>
        {/* Retrouver ce que personne ne porte est un besoin en soi — c'est même
            souvent la raison d'ouvrir la liste. */}
        <option value="aucun">Sans responsable</option>
        {utilisateurs.map((u) => (
          <option key={u.id} value={String(u.id)}>{u.nom}</option>
        ))}
      </select>
    </span>
  );
}
