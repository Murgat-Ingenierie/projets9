import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { epics } from "../api/endpoints";
import { ErrorBanner } from "../components/ErrorBanner";
import type { Epic, EpicCategory, EpicStatus } from "../types";

const STATUTS: EpicStatus[] = ["idee", "actif", "realise", "abandonne"];
const CATEGORIES: EpicCategory[] = ["operationnel", "strategique", "long_terme"];

export default function EpicsPage() {
  const [items, setItems] = useState<Epic[]>([]);
  const [err, setErr] = useState<unknown>(null);
  const [draft, setDraft] = useState<Partial<Epic>>({
    trigramme: "",
    nom: "",
    critere_reussite: "",
    statut: "idee",
    categorie: "operationnel",
  });

  function load() {
    epics.list().then(setItems).catch(setErr);
  }
  useEffect(load, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      await epics.create({
        ...draft,
        trigramme: (draft.trigramme ?? "").toUpperCase(),
      } as any);
      setDraft({ trigramme: "", nom: "", statut: "idee", categorie: "operationnel" });
      load();
    } catch (e) {
      setErr(e);
    }
  }

  async function remove(t: string) {
    if (!confirm(`Supprimer l'epic ${t} ?`)) return;
    try {
      await epics.remove(t);
      load();
    } catch (e) {
      setErr(e);
    }
  }

  return (
    <>
      <h2>Epics</h2>
      <ErrorBanner error={err} />
      <form className="form" onSubmit={create} style={{ marginBottom: 24 }}>
        <label>Trigramme (3 lettres MAJ, ex: O50)</label>
        <input
          maxLength={3}
          value={draft.trigramme ?? ""}
          onChange={(e) => setDraft({ ...draft, trigramme: e.target.value.toUpperCase() })}
          required
        />
        <label>Nom</label>
        <input
          value={draft.nom ?? ""}
          onChange={(e) => setDraft({ ...draft, nom: e.target.value })}
          required
        />
        <label>Critère de réussite</label>
        <textarea
          value={draft.critere_reussite ?? ""}
          onChange={(e) => setDraft({ ...draft, critere_reussite: e.target.value })}
        />
        <label>Statut</label>
        <select
          value={draft.statut}
          onChange={(e) => setDraft({ ...draft, statut: e.target.value as EpicStatus })}
        >
          {STATUTS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <label>Catégorie</label>
        <select
          value={draft.categorie}
          onChange={(e) => setDraft({ ...draft, categorie: e.target.value as EpicCategory })}
        >
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <button className="btn" type="submit">Ajouter</button>
      </form>

      <table>
        <thead>
          <tr>
            <th>Trigramme</th>
            <th>Nom</th>
            <th>Critère</th>
            <th>Statut</th>
            <th>Catégorie</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {items.map((e) => (
            <tr key={e.trigramme}>
              <td><Link to={`/epics/${e.trigramme}`}>{e.trigramme}</Link></td>
              <td>{e.nom}</td>
              <td>{e.critere_reussite}</td>
              <td><span className={`tag ${e.statut}`}>{e.statut}</span></td>
              <td>{e.categorie}</td>
              <td>
                <button className="btn danger" onClick={() => remove(e.trigramme)}>
                  Supprimer
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
