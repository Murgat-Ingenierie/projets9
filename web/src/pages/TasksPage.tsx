import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { projects, tasks, users } from "../api/endpoints";
import { Breadcrumb, type Crumb } from "../components/Breadcrumb";
import { ErrorBanner } from "../components/ErrorBanner";
import { useSortableList } from "../hooks/useSort";
import { navState } from "../hooks/useBreadcrumbState";
import { TASK_STATUS_LABELS, fmtDate } from "../labels";
import type { Project, Task, TaskStatus, User } from "../types";

const STATUTS: TaskStatus[] = ["ouvert", "archive"];

const PARENT: Crumb[] = [{ label: "Planning", to: "/" }];
const SELF: Crumb = { label: "Tâches", to: "/tasks" };

export default function TasksPage() {
  const nav = useNavigate();
  const [items, setItems] = useState<Task[]>([]);
  const [projs, setProjs] = useState<Project[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [err, setErr] = useState<unknown>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<Task>>({});

  function load() {
    Promise.all([tasks.list(), projects.list(), users.list()])
      .then(([t, p, u]) => {
        setItems(t);
        setProjs(p);
        setAllUsers(u);
      })
      .catch(setErr);
  }
  useEffect(load, []);

  const projNameById = useMemo(() => {
    const m = new Map<number, string>();
    projs.forEach((p) => m.set(p.id, p.nom));
    return m;
  }, [projs]);
  const userNameById = useMemo(() => {
    const m = new Map<number, string>();
    allUsers.forEach((u) => m.set(u.id, u.nom));
    return m;
  }, [allUsers]);

  const { sorted, sortHeader, filteredCount, totalCount } = useSortableList(items);

  function startEdit(t: Task) {
    setEditing(t.id);
    setEditDraft({ ...t });
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
      await tasks.update(editing, editDraft);
      cancelEdit();
      load();
    } catch (e) {
      setErr(e);
    }
  }
  async function removeRow(id: number) {
    if (!confirm("Supprimer cette tâche ?")) return;
    try {
      await tasks.remove(id);
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
        <h2>Tâches</h2>
        <button className="btn" onClick={() => nav("/tasks/new", navState(PARENT, SELF))}>+ Ajouter</button>
      </div>
      <ErrorBanner error={err} />
      <p className="muted">{filteredCount} sur {totalCount}</p>

      <table>
        <thead>
          <tr>
            {sortHeader("Projet", "projet", (t: Task) => projNameById.get(t.projet_id) ?? "")}
            {sortHeader("Nom", "nom", (t: Task) => t.nom)}
            {sortHeader("Début", "debut", (t: Task) => t.date_debut)}
            {sortHeader("Fin", "fin", (t: Task) => t.date_fin)}
            {sortHeader("Avancement", "av", (t: Task) => t.avancement)}
            {sortHeader("Responsable", "resp", (t: Task) => t.responsable_id ? userNameById.get(t.responsable_id) ?? "" : "")}
            {sortHeader("Statut", "statut", (t: Task) => TASK_STATUS_LABELS[t.statut])}
            <th></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((t) =>
            editing === t.id ? (
              <tr key={t.id} className="editing">
                <td>
                  <select
                    value={editDraft.projet_id ?? ""}
                    onChange={(ev) => setEditDraft({ ...editDraft, projet_id: ev.target.value ? Number(ev.target.value) : undefined })}
                  >
                    {projs.map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}
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
                  <input
                    type="number" min={0} max={100}
                    value={editDraft.avancement ?? 0}
                    onChange={(ev) => setEditDraft({ ...editDraft, avancement: Number(ev.target.value) })}
                    style={{ width: 70 }}
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
                    value={editDraft.statut ?? "ouvert"}
                    onChange={(ev) => setEditDraft({ ...editDraft, statut: ev.target.value as TaskStatus })}
                  >
                    {STATUTS.map((s) => <option key={s} value={s}>{TASK_STATUS_LABELS[s]}</option>)}
                  </select>
                </td>
                <td className="row-actions">
                  <button className="btn" onClick={saveEdit}>Enregistrer</button>
                  <button className="btn secondary" onClick={cancelEdit}>Annuler</button>
                  <button className="btn danger" onClick={() => removeRow(t.id)}>Supprimer</button>
                </td>
              </tr>
            ) : (
              <tr key={t.id}>
                <td>{projNameById.get(t.projet_id) ?? t.projet_id}</td>
                <td>{t.nom}</td>
                <td>{fmtDate(t.date_debut)}</td>
                <td>{fmtDate(t.date_fin)}</td>
                <td>{t.avancement}%</td>
                <td>{t.responsable_id ? userNameById.get(t.responsable_id) ?? "—" : "—"}</td>
                <td><span className={`tag ${t.statut}`}>{TASK_STATUS_LABELS[t.statut]}</span></td>
                <td><button className="btn secondary" onClick={() => startEdit(t)}>Éditer</button></td>
              </tr>
            )
          )}
        </tbody>
      </table>
    </>
  );
}
