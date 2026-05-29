import type { Project, ProjectStatus } from "../types";
import { PROJECT_STATUS_LABELS, PROJECT_STATUTS } from "../labels";
import { DateRangeInput } from "./DateRangeInput";
import { EpicSelect, UserSelect } from "./selects";

interface Props {
  draft: Partial<Project>;
  setDraft: (d: Partial<Project>) => void;
}

export function ProjectFormFields({ draft, setDraft }: Props) {
  return (
    <>
      <label>Epic</label>
      <EpicSelect
        value={draft.epic_trigramme ?? ""}
        onChange={(t) => setDraft({ ...draft, epic_trigramme: t })}
        required
      />
      <label>Nom</label>
      <input
        value={draft.nom ?? ""}
        onChange={(e) => setDraft({ ...draft, nom: e.target.value })}
        required
      />
      <label>Description</label>
      <textarea
        rows={2}
        value={draft.description ?? ""}
        onChange={(e) => setDraft({ ...draft, description: e.target.value })}
      />
      <DateRangeInput
        dateDebut={draft.date_debut ?? ""}
        dateFin={draft.date_fin ?? ""}
        onChangeDebut={(v) => setDraft({ ...draft, date_debut: v })}
        onChangeFin={(v) => setDraft({ ...draft, date_fin: v })}
      />
      <label>Responsable</label>
      <UserSelect
        value={draft.responsable_id ?? null}
        onChange={(id) => setDraft({ ...draft, responsable_id: id })}
      />
      <label>Statut</label>
      <select
        value={draft.statut ?? "prevu"}
        onChange={(e) => setDraft({ ...draft, statut: e.target.value as ProjectStatus })}
      >
        {PROJECT_STATUTS.map((s) => (
          <option key={s} value={s}>{PROJECT_STATUS_LABELS[s]}</option>
        ))}
      </select>
    </>
  );
}
