import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { epics } from "../api/endpoints";
import { Breadcrumb, type Crumb } from "../components/Breadcrumb";
import { ErrorBanner } from "../components/ErrorBanner";
import { useSortableList } from "../hooks/useSort";
import { navState } from "../hooks/useBreadcrumbState";
import { EPIC_CATEGORY_LABELS, EPIC_STATUS_LABELS } from "../labels";
import type { Epic, EpicCategory, EpicStatus } from "../types";
import { BoutonSupprimer } from "../components/BoutonSupprimer";

const STATUTS: EpicStatus[] = ["idee", "actif", "realise", "abandonne"];
const CATEGORIES: EpicCategory[] = ["operationnel", "strategique", "long_terme"];

const PARENT: Crumb[] = [{ label: "Planning", to: "/" }];
const SELF: Crumb = { label: "Epics", to: "/epics" };

export default function EpicsPage() {
  const nav = useNavigate();
  const [items, setItems] = useState<Epic[]>([]);
  const [err, setErr] = useState<unknown>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<Epic>>({});

  function load() {
    epics.list().then(setItems).catch(setErr);
  }
  useEffect(load, []);

  const { sorted, sortHeader, filteredCount, totalCount } = useSortableList(items);

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
  async function removeRow(t: string) {
    if (!confirm(`Supprimer l'epic "${t}" ?`)) return;
    try {
      await epics.remove(t);
      cancelEdit();
      load();
    } catch (e) {
      setErr(e);
    }
  }

  return (
    <>
      <Breadcrumb items={[...PARENT, { label: SELF.label }]} />
      <div className="page-header">
        <h2>Epics</h2>
        <button className="btn" onClick={() => nav("/epics/new", navState(PARENT, SELF))}>+ Ajouter</button>
      </div>
      <ErrorBanner error={err} />
      <p className="muted">{filteredCount} sur {totalCount}</p>

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
                <td className="row-actions">
                  <button className="btn" onClick={saveEdit}>Enregistrer</button>
                  <button className="btn secondary" onClick={cancelEdit}>Annuler</button>
                  <BoutonSupprimer onClick={() => removeRow(e.trigramme)}>Supprimer</BoutonSupprimer>
                </td>
              </tr>
            ) : (
              <tr key={e.trigramme}>
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span
                      style={{
                        display: "inline-block",
                        width: 14,
                        height: 14,
                        borderRadius: 3,
                        background: e.couleur ?? "#3f51b5",
                        border: "1px solid rgba(0,0,0,0.1)",
                        flexShrink: 0,
                      }}
                    />
                    <Link to={`/epics/${e.trigramme}`} state={navState(PARENT, SELF).state}>{e.nom}</Link>
                  </div>
                </td>
                <td>{e.critere_reussite}</td>
                <td><span className={`tag ${e.statut}`}>{EPIC_STATUS_LABELS[e.statut]}</span></td>
                <td>{EPIC_CATEGORY_LABELS[e.categorie]}</td>
                <td><button className="btn secondary" onClick={() => startEdit(e)}>Éditer</button></td>
              </tr>
            )
          )}
        </tbody>
      </table>
    </>
  );
}
