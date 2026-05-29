import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { projects, tasks, users } from "../api/endpoints";
import { Breadcrumb, type Crumb } from "../components/Breadcrumb";
import { ErrorBanner } from "../components/ErrorBanner";
import { ProjectSelect, UserSelect } from "../components/selects";
import { Switch } from "../components/Switch";
import { useInlineEdit } from "../hooks/useInlineEdit";
import { useSortableList } from "../hooks/useSort";
import { navState } from "../hooks/useBreadcrumbState";
import { fmtDate } from "../labels";
import type { Project, Task, User } from "../types";

const PARENT: Crumb[] = [{ label: "Planning", to: "/" }];
const SELF: Crumb = { label: "Tâches", to: "/tasks" };

export default function TasksPage() {
  const nav = useNavigate();
  const [items, setItems] = useState<Task[]>([]);
  const [projs, setProjs] = useState<Project[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [err, setErr] = useState<unknown>(null);
  const { editingId: editing, draft: editDraft, start, cancel, patch, isEditing } = useInlineEdit<Task>();

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
    start(t);
    setErr(null);
  }
  async function saveEdit() {
    if (editing == null) return;
    setErr(null);
    try {
      await tasks.update(editing, editDraft);
      cancel();
      load();
    } catch (e) {
      setErr(e);
    }
  }
  async function removeRow(id: number) {
    if (!confirm("Supprimer cette tâche ?")) return;
    try {
      await tasks.remove(id);
      cancel();
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
            {sortHeader("Responsable", "resp", (t: Task) => t.responsable_id ? userNameById.get(t.responsable_id) ?? "" : "")}
            {sortHeader("Fini", "fini", (t: Task) => t.statut === "archive" ? 1 : 0)}
            <th></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((t) =>
            isEditing(t.id) ? (
              <tr key={t.id} className="editing">
                <td>
                  <ProjectSelect
                    value={editDraft.projet_id ?? null}
                    onChange={(id) => patch({projet_id: id ?? undefined })}
                    projects={projs}
                    required
                  />
                </td>
                <td>
                  <input
                    value={editDraft.nom ?? ""}
                    onChange={(ev) => patch({nom: ev.target.value })}
                  />
                </td>
                <td>
                  <input
                    type="date"
                    value={editDraft.date_debut ?? ""}
                    onChange={(ev) => patch({date_debut: ev.target.value })}
                  />
                </td>
                <td>
                  <input
                    type="date"
                    value={editDraft.date_fin ?? ""}
                    onChange={(ev) => patch({date_fin: ev.target.value })}
                  />
                </td>
                <td>
                  <UserSelect
                    value={editDraft.responsable_id ?? null}
                    onChange={(id) => patch({responsable_id: id })}
                    users={allUsers}
                  />
                </td>
                <td>
                  <Switch
                    checked={editDraft.statut === "archive"}
                    onChange={(c) => patch({ statut: c ? "archive" : "ouvert" })}
                  />
                </td>
                <td className="row-actions">
                  <button className="btn" onClick={saveEdit}>Enregistrer</button>
                  <button className="btn secondary" onClick={cancel}>Annuler</button>
                  <button className="btn danger" onClick={() => removeRow(t.id)}>Supprimer</button>
                </td>
              </tr>
            ) : (
              <tr key={t.id}>
                <td>{projNameById.get(t.projet_id) ?? t.projet_id}</td>
                <td>{t.nom}</td>
                <td>{fmtDate(t.date_debut)}</td>
                <td>{fmtDate(t.date_fin)}</td>
                <td>{t.responsable_id ? userNameById.get(t.responsable_id) ?? "—" : "—"}</td>
                <td>
                  {t.statut === "archive" ? (
                    <span className="material-symbols-outlined" style={{ fontSize: 18, color: "#2e7d32" }}>check_circle</span>
                  ) : (
                    <span style={{ color: "#bdbdbd" }}>—</span>
                  )}
                </td>
                <td className="row-actions">
                  <button className="btn secondary" onClick={() => startEdit(t)}>Éditer</button>
                  <button
                    className="btn secondary"
                    onClick={() => nav(`/tasks/${t.id}/edit`, navState(PARENT, SELF))}
                  >
                    Ouvrir
                  </button>
                </td>
              </tr>
            )
          )}
        </tbody>
      </table>
    </>
  );
}
