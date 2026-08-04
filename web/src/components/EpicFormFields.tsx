import { useId } from "react";

import type { Epic, EpicCategory, EpicStatus } from "../types";
import {
  EPIC_CATEGORIES,
  EPIC_CATEGORY_LABELS,
  EPIC_STATUS_LABELS,
  EPIC_STATUTS,
} from "../labels";

interface Props {
  draft: Partial<Epic>;
  setDraft: (d: Partial<Epic>) => void;
  /** Si true, autoriser l'édition du trigramme (création uniquement). */
  allowTrigrammeEdit?: boolean;
}

export function EpicFormFields({ draft, setDraft, allowTrigrammeEdit }: Props) {
  const id = useId();
  return (
    <>
      {allowTrigrammeEdit && (
        <>
          <label htmlFor={`${id}-trigramme`}>Trigramme (3 lettres)</label>
          <input
            id={`${id}-trigramme`}
            value={draft.trigramme ?? ""}
            onChange={(e) =>
              setDraft({ ...draft, trigramme: e.target.value.toUpperCase().slice(0, 3) })
            }
            required
            maxLength={3}
            style={{ textTransform: "uppercase", letterSpacing: "0.1em" }}
          />
        </>
      )}
      <label htmlFor={`${id}-nom`}>Nom</label>
      <input
        id={`${id}-nom`}
        value={draft.nom ?? ""}
        onChange={(e) => setDraft({ ...draft, nom: e.target.value })}
        required
      />
      <label htmlFor={`${id}-critere`}>Critère de réussite</label>
      <textarea
        id={`${id}-critere`}
        rows={2}
        value={draft.critere_reussite ?? ""}
        onChange={(e) => setDraft({ ...draft, critere_reussite: e.target.value || null })}
      />
      <label htmlFor={`${id}-raison`}>Raison de la date de fin</label>
      <input
        id={`${id}-raison`}
        value={draft.raison_date_fin ?? ""}
        onChange={(e) => setDraft({ ...draft, raison_date_fin: e.target.value || null })}
      />
      <label htmlFor={`${id}-fin-prevue`}>Date de fin prévue</label>
      <input
        id={`${id}-fin-prevue`}
        type="date"
        value={draft.date_fin_prevue ?? ""}
        onChange={(e) => setDraft({ ...draft, date_fin_prevue: e.target.value || null })}
      />
      <label htmlFor={`${id}-jalon-max`}>Jalon de fin maximum</label>
      <input
        id={`${id}-jalon-max`}
        type="date"
        value={draft.jalon_fin_max ?? ""}
        onChange={(e) => setDraft({ ...draft, jalon_fin_max: e.target.value || null })}
      />
      <label htmlFor={`${id}-statut`}>Statut</label>
      <select
        id={`${id}-statut`}
        value={draft.statut ?? "idee"}
        onChange={(e) => setDraft({ ...draft, statut: e.target.value as EpicStatus })}
      >
        {EPIC_STATUTS.map((s) => (
          <option key={s} value={s}>{EPIC_STATUS_LABELS[s]}</option>
        ))}
      </select>
      <label htmlFor={`${id}-categorie`}>Catégorie</label>
      <select
        id={`${id}-categorie`}
        value={draft.categorie ?? "operationnel"}
        onChange={(e) => setDraft({ ...draft, categorie: e.target.value as EpicCategory })}
      >
        {EPIC_CATEGORIES.map((c) => (
          <option key={c} value={c}>{EPIC_CATEGORY_LABELS[c]}</option>
        ))}
      </select>
      <label htmlFor={`${id}-couleur`}>Couleur</label>
      {/* Le libellé vise le champ, pas le conteneur : le `<div>` n'est là que
          pour poser le code hexadécimal à côté du sélecteur. */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input
          id={`${id}-couleur`}
          type="color"
          value={draft.couleur ?? "#3f51b5"}
          onChange={(e) => setDraft({ ...draft, couleur: e.target.value })}
          style={{ width: 48, height: 32, padding: 0, cursor: "pointer", border: "1px solid #e0e0e0", borderRadius: 4 }}
        />
        <code style={{ color: "#5f6368", fontSize: 12 }}>{draft.couleur ?? "(défaut)"}</code>
      </div>
    </>
  );
}
