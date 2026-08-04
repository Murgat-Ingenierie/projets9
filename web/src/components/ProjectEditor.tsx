import { useEffect, useState } from "react";
import { projects } from "../api/endpoints";
import type { Project } from "../types";
import { ErrorBanner } from "./ErrorBanner";
import { ProjectFormFields } from "./ProjectFormFields";
import { BoutonSupprimer } from "./BoutonSupprimer";

interface Props {
  projectId?: number;
  initialDraft?: Partial<Project>;
  onSaved: () => void;
  onCancel: () => void;
  onDeleted?: () => void;
  showDelete?: boolean;
  formStyle?: React.CSSProperties;
}

const DEFAULT_DRAFT: Partial<Project> = {
  epic_trigramme: "",
  nom: "",
  date_debut: "",
  date_fin: "",
  statut: "prevu",
};

export function ProjectEditor({
  projectId,
  initialDraft,
  onSaved,
  onCancel,
  onDeleted,
  showDelete,
  formStyle,
}: Props) {
  const isEdit = projectId != null;
  const [draft, setDraft] = useState<Partial<Project>>({
    ...DEFAULT_DRAFT,
    ...(initialDraft ?? {}),
  });
  const [err, setErr] = useState<unknown>(null);
  const [loaded, setLoaded] = useState(!isEdit);

  useEffect(() => {
    if (!isEdit) return;
    projects
      .list()
      .then((ps) => {
        const p = ps.find((x) => x.id === projectId);
        if (!p) throw new Error(`Projet ${projectId} introuvable`);
        setDraft({ ...p });
        setLoaded(true);
      })
      .catch(setErr);
  }, [projectId, isEdit]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      if (isEdit) await projects.update(projectId!, draft);
      else await projects.create(draft);
      onSaved();
    } catch (e) {
      setErr(e);
    }
  }

  async function remove() {
    if (!isEdit || !confirm("Supprimer ce projet ?")) return;
    setErr(null);
    try {
      await projects.remove(projectId!);
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
        <ProjectFormFields draft={draft} setDraft={setDraft} />
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button className="btn" type="submit">{isEdit ? "Enregistrer" : "Créer"}</button>
          <button type="button" className="btn secondary" onClick={onCancel}>Annuler</button>
          {isEdit && showDelete && (
            <BoutonSupprimer onClick={remove} />
          )}
        </div>
      </form>
    </>
  );
}
