import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { epics } from "../api/endpoints";
import { ErrorBanner } from "../components/ErrorBanner";
import { useSortableList } from "../hooks/useSort";
import { EPIC_CATEGORY_LABELS, EPIC_STATUS_LABELS } from "../labels";
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
  const [editing, setEditing] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<Epic>>({});

  function load() {
    epics.list().then(setItems).catch(setErr);
  }
  useEffect(load, []);

  const { sorted, sortHeader } = useSortableList(items);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      await epics.create({ ...draft, trigramme: (draft.trigramme ?? "").toUpperCase() } as any);
      setDraft({ trigramme: "", nom: "", statut: "idee", categorie: "operationnel" });
      load();
    } catch (e) {
      setErr(e);
    }
  }

  async function remove(t: string) {
    if (!confirm(`Supprimer l'epic "${t}" ?`)) return;
    try {
      await epics.remove(t);
      load();
    } catch (e) {
      setErr(e);
    }
  }

  function startEdit(e: Epic) {
    setEditing(e.trigramme);
    setEditDraft({ ...e });
    setErr(null);
  }
  function cancelEdit() {
    setEditing(null);
    setEditDraft({});
  }
  async function saveEdit() {
    if (!editing) return;
    setErr(null);
    try {
      await epics.update(editing, editDraft);
      cancelEdit();
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
        <button className="btn" type="submit">Ajouter</button>
      </form>

      <table>
        <thead>
          <tr>
            {sortHeader("Nom", "nom", (e: Epic) => e.nom)}
            {sortHeader("Critère de réussite", "critere", (e: Epic) => e.critere_reussite)}
            {sortHeader("Statut", "statut", (e: Epic) => EPIC_STATUS_LABELS[e.statut])}
            {sortHeader("Catégorie", "categorie", (e: Epic) => EPIC_CATEGORY_LABELS[e.categorie])}
            <th></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((e) =>
            editing === e.trigramme ? (
              <tr key={e.trigramme} className="editing">
                <td>
                  <input
                    value={editDraft.nom ?? ""}
                    onChange={(ev) => setEditDraft({ ...editDraft, nom: ev.target.value })}
                  />
                </td>
                <td>
                  <textarea
                    rows={2}
                    value={editDraft.critere_reussite ?? ""}
                    onChange={(ev) => setEditDraft({ ...editDraft, critere_reussite: ev.target.value })}
                  />
                </td>
                <td>
                  <select
                    value={editDraft.statut ?? "idee"}
                    onChange={(ev) => setEditDraft({ ...editDraft, statut: ev.target.value as EpicStatus })}
                  >
                    {STATUTS.map((s) => <option key={s} value={s}>{EPIC_STATUS_LABELS[s]}</option>)}
                  </select>
                </td>
                <td>
                  <select
                    value={editDraft.categorie ?? "operationnel"}
                    onChange={(ev) => setEditDraft({ ...editDraft, categorie: ev.target.value as EpicCategory })}
                  >
                    {CATEGORIES.map((c) => <option key={c} value={c}>{EPIC_CATEGORY_LABELS[c]}</option>)}
                  </select>
                </td>
                <td>
                  <button className="btn" onClick={saveEdit}>Enregistrer</button>{" "}
                  <button className="btn secondary" onClick={cancelEdit}>Annuler</button>
                </td>
              </tr>
            ) : (
              <tr key={e.trigramme}>
                <td><Link to={`/epics/${e.trigramme}`}>{e.nom}</Link></td>
                <td>{e.critere_reussite}</td>
                <td><span className={`tag ${e.statut}`}>{EPIC_STATUS_LABELS[e.statut]}</span></td>
                <td>{EPIC_CATEGORY_LABELS[e.categorie]}</td>
                <td>
                  <button className="btn secondary" onClick={() => startEdit(e)}>Éditer</button>{" "}
                  <button className="btn danger" onClick={() => remove(e.trigramme)}>Supprimer</button>
                </td>
              </tr>
            )
          )}
        </tbody>
      </table>
    </>
  );
}
