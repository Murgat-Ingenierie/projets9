import { useEffect, useState } from "react";
import { tasks } from "../api/endpoints";
import type { Task } from "../types";
import { ErrorBanner } from "./ErrorBanner";
import { TaskFormFields } from "./TaskFormFields";

interface Props {
  /** Si défini → mode édition. Sinon → mode création. */
  taskId?: number;
  /** Valeurs initiales (mode création). */
  initialDraft?: Partial<Task>;
  onSaved: () => void;
  onCancel: () => void;
  /** Appelé après suppression réussie. Si absent, onSaved est utilisé. */
  onDeleted?: () => void;
  /** Affiche le bouton Supprimer (mode édition uniquement). */
  showDelete?: boolean;
  /** Style optionnel passé au <form> (pour les conteneurs panel). */
  formStyle?: React.CSSProperties;
}

function isoDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function TaskEditor({
  taskId,
  initialDraft,
  onSaved,
  onCancel,
  onDeleted,
  showDelete,
  formStyle,
}: Props) {
  const isEdit = taskId != null;
  const [draft, setDraft] = useState<Partial<Task>>(() => {
    const today = new Date();
    const inAWeek = new Date(today);
    inAWeek.setDate(inAWeek.getDate() + 7);
    return {
      nom: "",
      date_debut: isoDate(today),
      date_fin: isoDate(inAWeek),
      statut: "ouvert",
      ...(initialDraft ?? {}),
    };
  });
  const [err, setErr] = useState<unknown>(null);
  const [loaded, setLoaded] = useState(!isEdit);

  useEffect(() => {
    if (!isEdit) return;
    tasks
      .list()
      .then((ts) => {
        const t = ts.find((x) => x.id === taskId);
        if (!t) throw new Error(`Tâche ${taskId} introuvable`);
        setDraft({ ...t });
        setLoaded(true);
      })
      .catch(setErr);
  }, [taskId, isEdit]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      if (isEdit) await tasks.update(taskId!, draft);
      else await tasks.create(draft);
      onSaved();
    } catch (e) {
      setErr(e);
    }
  }

  async function remove() {
    if (!isEdit || !confirm("Supprimer cette tâche ?")) return;
    setErr(null);
    try {
      await tasks.remove(taskId!);
      (onDeleted ?? onSaved)();
    } catch (e) {
      setErr(e);
    }
  }

  if (!loaded && !err) return <p>Chargement…</p>;

  return (
    <>
      <ErrorBanner error={err} />
      <form className="form" onSubmit={save} style={formStyle}>
        <TaskFormFields draft={draft} setDraft={setDraft} />
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button className="btn" type="submit">{isEdit ? "Enregistrer" : "Créer"}</button>
          <button type="button" className="btn secondary" onClick={onCancel}>Annuler</button>
          {isEdit && showDelete && (
            <button type="button" className="btn danger" onClick={remove}>Supprimer</button>
          )}
        </div>
      </form>
    </>
  );
}
