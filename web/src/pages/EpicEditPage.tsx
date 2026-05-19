import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { epics } from "../api/endpoints";
import { ErrorBanner } from "../components/ErrorBanner";
import { EPIC_CATEGORY_LABELS, EPIC_STATUS_LABELS } from "../labels";
import type { Epic, EpicCategory, EpicStatus } from "../types";

const STATUTS: EpicStatus[] = ["idee", "actif", "realise", "abandonne"];
const CATEGORIES: EpicCategory[] = ["operationnel", "strategique", "long_terme"];

export default function EpicEditPage() {
  const { trigramme = "" } = useParams();
  const nav = useNavigate();
  const [err, setErr] = useState<unknown>(null);
  const [loaded, setLoaded] = useState(false);
  const [draft, setDraft] = useState<Partial<Epic>>({});

  useEffect(() => {
    epics
      .get(trigramme)
      .then((e) => {
        setDraft({ ...e });
        setLoaded(true);
      })
      .catch(setErr);
  }, [trigramme]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      await epics.update(trigramme, draft);
      nav("/epics");
    } catch (e) {
      setErr(e);
    }
  }

  async function remove() {
    if (!confirm(`Supprimer l'epic "${trigramme}" ?`)) return;
    try {
      await epics.remove(trigramme);
      nav("/epics");
    } catch (e) {
      setErr(e);
    }
  }

  if (!loaded && !err) return <p>Chargement…</p>;

  return (
    <>
      <h2>Modifier l'epic : {draft.nom}</h2>
      <ErrorBanner error={err} />
      <form className="form" onSubmit={save}>
        <label>Nom</label>
        <input value={draft.nom ?? ""} onChange={(e) => setDraft({ ...draft, nom: e.target.value })} required />
        <label>Critère de réussite</label>
        <textarea
          value={draft.critere_reussite ?? ""}
          onChange={(e) => setDraft({ ...draft, critere_reussite: e.target.value })}
        />
        <label>Raison de la date de fin</label>
        <input
          value={draft.raison_date_fin ?? ""}
          onChange={(e) => setDraft({ ...draft, raison_date_fin: e.target.value })}
        />
        <label>Date de fin prévue</label>
        <input
          type="date"
          value={draft.date_fin_prevue ?? ""}
          onChange={(e) => setDraft({ ...draft, date_fin_prevue: e.target.value || null })}
        />
        <label>Jalon de fin maximum</label>
        <input
          type="date"
          value={draft.jalon_fin_max ?? ""}
          onChange={(e) => setDraft({ ...draft, jalon_fin_max: e.target.value || null })}
        />
        <label>Statut</label>
        <select
          value={draft.statut ?? "idee"}
          onChange={(e) => setDraft({ ...draft, statut: e.target.value as EpicStatus })}
        >
          {STATUTS.map((s) => <option key={s} value={s}>{EPIC_STATUS_LABELS[s]}</option>)}
        </select>
        <label>Catégorie</label>
        <select
          value={draft.categorie ?? "operationnel"}
          onChange={(e) => setDraft({ ...draft, categorie: e.target.value as EpicCategory })}
        >
          {CATEGORIES.map((c) => <option key={c} value={c}>{EPIC_CATEGORY_LABELS[c]}</option>)}
        </select>
        <label>
          <input
            type="checkbox"
            checked={!!draft.critere_atteint}
            onChange={(e) => setDraft({ ...draft, critere_atteint: e.target.checked })}
          />
          {" "}Critère atteint
        </label>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button className="btn" type="submit">Enregistrer</button>
          <button type="button" className="btn secondary" onClick={() => nav("/epics")}>Annuler</button>
          <button type="button" className="btn danger" onClick={remove}>Supprimer</button>
        </div>
      </form>
    </>
  );
}
