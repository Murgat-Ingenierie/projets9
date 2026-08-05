import { useId } from "react";

import type { Task } from "../types";
import { DateRangeInput } from "./DateRangeInput";
import { EquipeSelect, ProjectSelect, UserSelect } from "./selects";
import { Switch } from "./Switch";

/** Rattachement d'une équipe, à la création seulement.
 *
 *  Hors du brouillon de tâche à dessein : une allocation est une AUTRE entité
 *  (`tache_equipe`), créée par un second appel une fois la tâche connue — elle a
 *  besoin de son identifiant. La mêler au brouillon donnerait à croire que
 *  `POST /api/tasks` sait la prendre en charge. */
export interface Allocation {
  equipeId: number | null;
  setEquipeId: (id: number | null) => void;
  heures: string;
  setHeures: (h: string) => void;
}

interface Props {
  draft: Partial<Task>;
  setDraft: (d: Partial<Task>) => void;
  /** Absent en édition : les allocations existantes se règlent dans Charge équipes,
   *  où l'on voit la semaine entière — seul endroit où arbitrer une surcharge. */
  allocation?: Allocation;
}

export function TaskFormFields({ draft, setDraft, allocation }: Props) {
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
      {allocation && (
        <>
          <label htmlFor={`${id}-equipe`}>Équipe (facultatif)</label>
          <EquipeSelect
            id={`${id}-equipe`}
            value={allocation.equipeId}
            onChange={(eq) => {
              allocation.setEquipeId(eq);
              // Vider les heures quand on retire l'équipe : les laisser afficherait
              // une allocation qui ne sera pas créée.
              if (eq === null) allocation.setHeures("");
            }}
          />
          {/* Les heures ne sont exigées QUE si une équipe est choisie : la base
              impose `heures > 0`, on ne peut donc pas rattacher une équipe sans
              en allouer. Le `required` conditionnel fait porter ce refus par le
              navigateur, avant l'envoi, plutôt que par un 409 après coup. */}
          {allocation.equipeId !== null && (
            <>
              <label htmlFor={`${id}-heures`}>Heures allouées</label>
              <input
                id={`${id}-heures`}
                type="number"
                min={0.5}
                step={0.5}
                value={allocation.heures}
                onChange={(e) => allocation.setHeures(e.target.value)}
                required
              />
            </>
          )}
        </>
      )}
      <label htmlFor={`${id}-fini`}>Fini</label>
      <Switch
        id={`${id}-fini`}
        checked={draft.statut === "archive"}
        onChange={(c) => setDraft({ ...draft, statut: c ? "archive" : "ouvert" })}
      />
    </>
  );
}
