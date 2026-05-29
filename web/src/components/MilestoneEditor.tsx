import { useEffect, useState } from "react";
import { milestones as milestonesApi } from "../api/endpoints";
import type { Milestone } from "../types";
import { ErrorBanner } from "./ErrorBanner";
import { MilestoneFormFields } from "./MilestoneFormFields";

interface Props {
  milestoneId?: number;
  initialDraft?: Partial<Milestone>;
  onSaved: () => void;
  onCancel: () => void;
  onDeleted?: () => void;
  showDelete?: boolean;
  formStyle?: React.CSSProperties;
}

const DEFAULT_DRAFT: Partial<Milestone> = {
  nom: "",
  date: "",
  atteint: false,
  epic_trigrammes: [],
};

export function MilestoneEditor({
  milestoneId,
  initialDraft,
  onSaved,
  onCancel,
  onDeleted,
  showDelete,
  formStyle,
}: Props) {
  const isEdit = milestoneId != null;
  const [draft, setDraft] = useState<Partial<Milestone>>({
    ...DEFAULT_DRAFT,
    ...(initialDraft ?? {}),
  });
  const [err, setErr] = useState<unknown>(null);
  const [loaded, setLoaded] = useState(!isEdit);

  useEffect(() => {
    if (!isEdit) return;
    milestonesApi
      .list()
      .then((ms) => {
        const m = ms.find((x) => x.id === milestoneId);
        if (!m) throw new Error(`Jalon ${milestoneId} introuvable`);
        setDraft({ ...m });
        setLoaded(true);
      })
      .catch(setErr);
  }, [milestoneId, isEdit]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!draft.epic_trigrammes || draft.epic_trigrammes.length === 0) {
      setErr(new Error("Sélectionne au moins un epic."));
      return;
    }
    try {
      const payload: Partial<Milestone> = {
        nom: draft.nom,
        date: draft.date,
        atteint: draft.atteint ?? false,
        epic_trigrammes: draft.epic_trigrammes,
      };
      if (isEdit) await milestonesApi.update(milestoneId!, payload);
      else await milestonesApi.create(payload);
      onSaved();
    } catch (e) {
      setErr(e);
    }
  }

  async function remove() {
    if (!isEdit || !confirm("Supprimer ce jalon ?")) return;
    setErr(null);
    try {
      await milestonesApi.remove(milestoneId!);
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
        <MilestoneFormFields draft={draft} setDraft={setDraft} />
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
