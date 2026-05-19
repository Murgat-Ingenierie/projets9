import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { epics } from "../api/endpoints";
import { ErrorBanner } from "../components/ErrorBanner";
import { EPIC_CATEGORY_LABELS, EPIC_STATUS_LABELS } from "../labels";
import type { Epic, EpicCategory, EpicStatus } from "../types";

const STATUTS: EpicStatus[] = ["idee", "actif", "realise", "abandonne"];
const CATEGORIES: EpicCategory[] = ["operationnel", "strategique", "long_terme"];

export default function EpicNewPage() {
  const nav = useNavigate();
  const [err, setErr] = useState<unknown>(null);
  const [draft, setDraft] = useState<Partial<Epic>>({
    trigramme: "",
    nom: "",
    critere_reussite: "",
    statut: "idee",
    categorie: "operationnel",
    couleur: "#3f51b5",
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      await epics.create({ ...draft, trigramme: (draft.trigramme ?? "").toUpperCase() } as any);
      nav("/epics");
    } catch (e) {
      setErr(e);
    }
  }

  return (
    <>
      <h2>Nouvel epic</h2>
      <ErrorBanner error={err} />
      <form className="form" onSubmit={submit}>
        <label>Identifiant court (3 lettres/chiffres, ex : O50)</label>
        <input
          maxLength={3}
          value={draft.trigramme ?? ""}
          onChange={(e) => setDraft({ ...draft, trigramme: e.target.value.toUpperCase() })}
          required
        />
        <label>Nom</label>
        <input value={draft.nom ?? ""} onChange={(e) => setDraft({ ...draft, nom: e.target.value })} required />
        <label>Critère de réussite</label>
        <textarea
          value={draft.critere_reussite ?? ""}
          onChange={(e) => setDraft({ ...draft, critere_reussite: e.target.value })}
        />
        <label>Statut</label>
        <select value={draft.statut} onChange={(e) => setDraft({ ...draft, statut: e.target.value as EpicStatus })}>
          {STATUTS.map((s) => <option key={s} value={s}>{EPIC_STATUS_LABELS[s]}</option>)}
        </select>
        <label>Catégorie</label>
        <select value={draft.categorie} onChange={(e) => setDraft({ ...draft, categorie: e.target.value as EpicCategory })}>
          {CATEGORIES.map((c) => <option key={c} value={c}>{EPIC_CATEGORY_LABELS[c]}</option>)}
        </select>
        <label>Couleur (utilisée sur le Gantt)</label>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="color"
            value={draft.couleur ?? "#3f51b5"}
            onChange={(e) => setDraft({ ...draft, couleur: e.target.value })}
            style={{ width: 56, height: 36, padding: 0, cursor: "pointer" }}
          />
          <code style={{ color: "#5f6368", fontSize: 12 }}>{draft.couleur ?? "—"}</code>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button className="btn" type="submit">Créer</button>
          <button type="button" className="btn secondary" onClick={() => nav("/epics")}>Annuler</button>
        </div>
      </form>
    </>
  );
}
