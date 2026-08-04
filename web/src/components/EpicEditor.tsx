import { useEffect, useState } from "react";
import { epics } from "../api/endpoints";
import type { Epic } from "../types";
import { EpicFormFields } from "./EpicFormFields";
import { ErrorBanner } from "./ErrorBanner";
import { BoutonSupprimer } from "./BoutonSupprimer";

interface Props {
  /** Trigramme défini → édition. Sinon → création (le trigramme est saisi). */
  trigramme?: string;
  initialDraft?: Partial<Epic>;
  onSaved: () => void;
  onCancel: () => void;
  onDeleted?: () => void;
  showDelete?: boolean;
  formStyle?: React.CSSProperties;
}

const DEFAULT_DRAFT: Partial<Epic> = {
  trigramme: "",
  nom: "",
  critere_reussite: "",
  statut: "idee",
  categorie: "operationnel",
  couleur: "#3f51b5",
};

export function EpicEditor({
  trigramme,
  initialDraft,
  onSaved,
  onCancel,
  onDeleted,
  showDelete,
  formStyle,
}: Props) {
  const isEdit = trigramme != null;
  const [draft, setDraft] = useState<Partial<Epic>>({
    ...DEFAULT_DRAFT,
    ...(initialDraft ?? {}),
  });
  const [err, setErr] = useState<unknown>(null);
  const [loaded, setLoaded] = useState(!isEdit);

  useEffect(() => {
    if (!isEdit) return;
    epics
      .get(trigramme!)
      .then((e) => {
        setDraft({ ...e });
        setLoaded(true);
      })
      .catch(setErr);
  }, [trigramme, isEdit]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      if (isEdit) {
        await epics.update(trigramme!, draft);
      } else {
        await epics.create({
          ...draft,
          trigramme: (draft.trigramme ?? "").toUpperCase(),
        } as any);
      }
      onSaved();
    } catch (e) {
      setErr(e);
    }
  }

  async function remove() {
    if (!isEdit || !confirm(`Supprimer l'epic "${trigramme}" et tous ses projets ?`)) return;
    setErr(null);
    try {
      await epics.remove(trigramme!);
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
        <EpicFormFields draft={draft} setDraft={setDraft} allowTrigrammeEdit={!isEdit} />
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
