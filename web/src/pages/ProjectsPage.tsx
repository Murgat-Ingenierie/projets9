import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { epics, projects, users } from "../api/endpoints";
import { Breadcrumb } from "../components/Breadcrumb";
import { ErrorBanner } from "../components/ErrorBanner";
import { useSortableList } from "../hooks/useSort";
import { PROJECT_STATUS_LABELS, fmtDate } from "../labels";
import type { Epic, Project, ProjectStatus, User } from "../types";

const STATUTS: ProjectStatus[] = ["prevu", "en_cours", "realise", "abandonne"];

export default function ProjectsPage() {
  const nav = useNavigate();
  const [items, setItems] = useState<Project[]>([]);
  const [allEpics, setAllEpics] = useState<Epic[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [err, setErr] = useState<unknown>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<Project>>({});

  function load() {
    Promise.all([projects.list(), epics.list(), users.list()])
      .then(([p, e, u]) => {
        setItems(p);
        setAllEpics(e);
        setAllUsers(u);
      })
      .catch(setErr);
  }
  useEffect(load, []);

  const epicNameByTri = useMemo(() => {
    const m = new Map<string, string>();
    allEpics.forEach((e) => m.set(e.trigramme, e.nom));
    return m;
  }, [allEpics]);
  const userNameById = useMemo(() => {
    const m = new Map<number, string>();
    allUsers.forEach((u) => m.set(u.id, u.nom));
    return m;
  }, [allUsers]);

  const { sorted, sortHeader, filteredCount, totalCount } = useSortableList(items);

  function startEdit(p: Project) {
    setEditing(p.id);
    setEditDraft({ ...p });
    setErr(null);
  }
  function cancelEdit() {
    setEditing(null);
    setEditDraft({});
  }
  async function saveEdit() {
    if (editing == null) return;
    setErr(null);
    try {
      await projects.update(editing, editDraft);
      cancelEdit();
      load();
    } catch (e) {
      setErr(e);
    }
  }
  async function removeRow(id: number) {
    if (!confirm("Supprimer ce projet ?")) return;
    try {
      await projects.remove(id);
      cancelEdit();
      load();
    } catch (e) {
      setErr(e);
    }
  }

  return (
    <>
      <Breadcrumb items={[{ label: "Planning", to: "/" }, { label: "Projets" }]} />
      <div className="page-header">
        <h2>Projets</h2>
        <button className="btn" onClick={() => nav("/projects/new")}>+ Ajouter</button>
      </div>
      <ErrorBanner error={err} />
      <p className="muted">{filteredCount} sur {totalCount}</p>

      <table>
        <thead>
          <tr>
            {sortHeader("Epic", "epic", (p: Project) => epicNameByTri.get(p.epic_trigramme) ?? p.epic_trigramme)}
            {sortHeader("Nom", "nom", (p: Project) => p.nom)}
            {sortHeader("Début", "debut", (p: Project) => p.date_debut)}
            {sortHeader("Fin", "fin", (p: Project) => p.date_fin)}
            {sortHeader("Responsable", "responsable", (p: Project) => p.responsable_id ? userNameById.get(p.responsable_id) ?? "" : "")}
            {sortHeader("Statut", "statut", (p: Project) => PROJECT_STATUS_LABELS[p.statut])}
            <th></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((p) =>
            editing === p.id ? (
              <tr key={p.id} className="editing">
                <td>
                  <select
                    value={editDraft.epic_trigramme ?? ""}
                    onChange={(ev) => setEditDraft({ ...editDraft, epic_trigramme: ev.target.value })}
                  >
                    {allEpics.map((e) => <option key={e.trigramme} value={e.trigramme}>{e.nom}</option>)}
                  </select>
                </td>
                <td>
                  <input
                    value={editDraft.nom ?? ""}
                    onChange={(ev) => setEditDraft({ ...editDraft, nom: ev.target.value })}
                  />
                </td>
                <td>
                  <input
                    type="date"
                    value={editDraft.date_debut ?? ""}
                    onChange={(ev) => setEditDraft({ ...editDraft, date_debut: ev.target.value })}
                  />
                </td>
                <td>
                  <input
                    type="date"
                    value={editDraft.date_fin ?? ""}
                    onChange={(ev) => setEditDraft({ ...editDraft, date_fin: ev.target.value })}
                  />
                </td>
                <td>
                  <select
                    value={editDraft.responsable_id ?? ""}
                    onChange={(ev) => setEditDraft({ ...editDraft, responsable_id: ev.target.value ? Number(ev.target.value) : null })}
                  >
                    <option value="">—</option>
                    {allUsers.map((u) => <option key={u.id} value={u.id}>{u.nom}</option>)}
                  </select>
                </td>
                <td>
                  <select
                    value={editDraft.statut ?? "prevu"}
                    onChange={(ev) => setEditDraft({ ...editDraft, statut: ev.target.value as ProjectStatus })}
                  >
                    {STATUTS.map((s) => <option key={s} value={s}>{PROJECT_STATUS_LABELS[s]}</option>)}
                  </select>
                </td>
                <td className="row-actions">
                  <button className="btn" onClick={saveEdit}>Enregistrer</button>
                  <button className="btn secondary" onClick={cancelEdit}>Annuler</button>
                  <button className="btn danger" onClick={() => removeRow(p.id)}>Supprimer</button>
                </td>
              </tr>
            ) : (
              <tr key={p.id}>
                <td>{epicNameByTri.get(p.epic_trigramme) ?? p.epic_trigramme}</td>
                <td>{p.nom}</td>
                <td>{fmtDate(p.date_debut)}</td>
                <td>{fmtDate(p.date_fin)}</td>
                <td>{p.responsable_id ? userNameById.get(p.responsable_id) ?? "—" : "—"}</td>
                <td><span className={`tag ${p.statut}`}>{PROJECT_STATUS_LABELS[p.statut]}</span></td>
                <td><button className="btn secondary" onClick={() => startEdit(p)}>Éditer</button></td>
              </tr>
            )
          )}
        </tbody>
      </table>
    </>
  );
}
