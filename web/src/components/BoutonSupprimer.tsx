// Bouton de suppression — visible des seuls administrateurs.
//
// Les neuf endpoints `DELETE` de l'API exigent tous `require_admin` depuis C7 :
// la portée d'une suppression est la vraie raison (les clés étrangères sont en
// CASCADE, supprimer un epic emporte ses projets, leurs tâches, et par ricochet
// dépendances, mesures et allocations). L'interface, elle, continuait d'offrir
// ces boutons à tout le monde — un membre les voyait, cliquait, et récoltait un
// 403. Proposer une action qu'on refuse ensuite est un défaut en soi.
//
// Le rôle est vérifié ICI (via `useEstAdmin`) plutôt qu'à chacun des quatorze appels : la règle tient
// en un endroit, et un bouton ajouté plus tard en hérite sans qu'on y pense.
// C'est aussi ce qui évite qu'un oubli passe inaperçu — un `{estAdmin && …}`
// manquant ne se voit pas à la relecture.
//
// ⚠️ Confort d'interface, PAS une protection. Ce qui garde réellement les
// données, ce sont les `require_admin` côté API : masquer un bouton n'empêche
// personne d'appeler l'endpoint.

import type { ReactNode } from "react";

import { useEstAdmin } from "../hooks/useEstAdmin";

interface Props {
  onClick: () => void;
  /** Libellé. Certaines tables utilisent « × » faute de place. */
  children?: ReactNode;
  /** Classe complète du bouton, si la place impose une autre forme. */
  className?: string;
  title?: string;
  disabled?: boolean;
}

export function BoutonSupprimer({
  onClick,
  children = "Supprimer",
  className = "btn danger",
  title,
  disabled,
}: Props) {
  // Appel du hook AVANT toute sortie : l'écrire dans la condition le rendrait
  // conditionnel aux yeux des règles de hooks, et le sens en dépend.
  const estAdmin = useEstAdmin();
  if (!estAdmin) return null;
  return (
    <button type="button" className={className} onClick={onClick} title={title} disabled={disabled}>
      {children}
    </button>
  );
}
