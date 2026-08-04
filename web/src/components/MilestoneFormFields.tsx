import { useId } from "react";

import type { Milestone } from "../types";
import { ProjectMultiSelect } from "./ProjectMultiSelect";
import { Switch } from "./Switch";

interface Props {
  draft: Partial<Milestone>;
  setDraft: (d: Partial<Milestone>) => void;
}

export function MilestoneFormFields({ draft, setDraft }: Props) {
  const id = useId();
  return (
    <>
      <label htmlFor={`${id}-nom`}>Nom</label>
      <input
        id={`${id}-nom`}
        value={draft.nom ?? ""}
        onChange={(e) => setDraft({ ...draft, nom: e.target.value })}
        required
      />
      <label htmlFor={`${id}-date`}>Date</label>
      <input
        id={`${id}-date`}
        type="date"
        value={draft.date ?? ""}
        onChange={(e) => setDraft({ ...draft, date: e.target.value })}
        required
      />
      <label htmlFor={`${id}-projets`}>Projets rattachés (au moins 1)</label>
      <ProjectMultiSelect
        id={`${id}-projets`}
        value={draft.project_ids ?? []}
        onChange={(ids) => setDraft({ ...draft, project_ids: ids })}
      />
      {(draft.project_ids ?? []).length === 0 && (
        <small style={{ color: "#c62828" }}>Sélectionne au moins un projet.</small>
      )}
      <label htmlFor={`${id}-atteint`}>Atteint</label>
      <Switch
        id={`${id}-atteint`}
        checked={!!draft.atteint}
        onChange={(c) => setDraft({ ...draft, atteint: c })}
      />
    </>
  );
}
