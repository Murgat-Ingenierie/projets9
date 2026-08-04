import { useId } from "react";

import type { Task } from "../types";
import { DateRangeInput } from "./DateRangeInput";
import { ProjectSelect, UserSelect } from "./selects";
import { Switch } from "./Switch";

interface Props {
  draft: Partial<Task>;
  setDraft: (d: Partial<Task>) => void;
}

export function TaskFormFields({ draft, setDraft }: Props) {
  const id = useId();
  return (
    <>
      <label htmlFor={`${id}-projet`}>Projet</label>
      <ProjectSelect
        id={`${id}-projet`}
        value={draft.projet_id ?? null}
        onChange={(id) => setDraft({ ...draft, projet_id: id ?? undefined })}
        required
      />
      <label htmlFor={`${id}-nom`}>Nom</label>
      <input
        id={`${id}-nom`}
        value={draft.nom ?? ""}
        onChange={(e) => setDraft({ ...draft, nom: e.target.value })}
        required
      />
      <DateRangeInput
        dateDebut={draft.date_debut ?? ""}
        dateFin={draft.date_fin ?? ""}
        onChangeDebut={(v) => setDraft({ ...draft, date_debut: v })}
        onChangeFin={(v) => setDraft({ ...draft, date_fin: v })}
      />
      <label htmlFor={`${id}-responsable`}>Responsable</label>
      <UserSelect
        id={`${id}-responsable`}
        value={draft.responsable_id ?? null}
        onChange={(id) => setDraft({ ...draft, responsable_id: id })}
      />
      <label htmlFor={`${id}-fini`}>Fini</label>
      <Switch
        id={`${id}-fini`}
        checked={draft.statut === "archive"}
        onChange={(c) => setDraft({ ...draft, statut: c ? "archive" : "ouvert" })}
      />
    </>
  );
}
