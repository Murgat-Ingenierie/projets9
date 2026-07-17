import type { Milestone } from "../types";
import { ProjectMultiSelect } from "./ProjectMultiSelect";
import { Switch } from "./Switch";

interface Props {
  draft: Partial<Milestone>;
  setDraft: (d: Partial<Milestone>) => void;
}

export function MilestoneFormFields({ draft, setDraft }: Props) {
  return (
    <>
      <label>Nom</label>
      <input
        value={draft.nom ?? ""}
        onChange={(e) => setDraft({ ...draft, nom: e.target.value })}
        required
      />
      <label>Date</label>
      <input
        type="date"
        value={draft.date ?? ""}
        onChange={(e) => setDraft({ ...draft, date: e.target.value })}
        required
      />
      <label>Projets rattachés (au moins 1)</label>
      <ProjectMultiSelect
        value={draft.project_ids ?? []}
        onChange={(ids) => setDraft({ ...draft, project_ids: ids })}
      />
      {(draft.project_ids ?? []).length === 0 && (
        <small style={{ color: "#c62828" }}>Sélectionne au moins un projet.</small>
      )}
      <label>Atteint</label>
      <Switch
        checked={!!draft.atteint}
        onChange={(c) => setDraft({ ...draft, atteint: c })}
      />
    </>
  );
}
