import { useEffect, useMemo, useState } from "react";
import { projects, tasks, users } from "../api/endpoints";
import { ErrorBanner } from "../components/ErrorBanner";
import { useSortableList } from "../hooks/useSort";
import { TASK_STATUS_LABELS, fmtDate } from "../labels";
import type { Project, Task, TaskStatus, User } from "../types";

const STATUTS: TaskStatus[] = ["prevu", "en_cours", "realise", "abandonne"];

export default function TasksPage() {
  const [items, setItems] = useState<Task[]>([]);
  const [projs, setProjs] = useState<Project[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [err, setErr] = useState<unknown>(null);
  const [draft, setDraft] = useState<Partial<Task>>({
    nom: "",
    date_debut: "",
    date_fin: "",
    avancement: 0,
    statut: "prevu",
  });
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

  const { sorted, sortHeader } = useSortableList(items);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      await tasks.create(draft);
      setDraft({ nom: "", date_debut: "", date_fin: "", avancement: 0, statut: "prevu" });
      load();
    } catch (e) {
      setErr(e);
    }
  }

  async function remove(id: number) {
    if (!confirm("Supprimer cette tâche ?")) return;
    try {
      await tasks.remove(id);
      load();
    } catch (e) {
      setErr(e);
    }
  }

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

  return (
    <>
      <h2>Tâches</h2>
      <ErrorBanner error={err} />
      <form className="form" onSubmit={create} style={{ marginBottom: 24 }}>
        <label>Projet</label>
        <select
          value={draft.projet_id ?? ""}
          onChange={(e) => setDraft({ ...draft, projet_id: e.target.value ? Number(e.target.value) : undefined })}
          required
        >
          <option value="">—</option>
          {projs.map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}
        </select>
        <label>Nom</label>
        <input value={draft.nom ?? ""} onChange={(e) => setDraft({ ...draft, nom: e.target.value })} required />
        <label>Date de début</label>
        <input type="date" value={draft.date_debut ?? ""} onChange={(e) => setDraft({ ...draft, date_debut: e.target.value })} required />
        <label>Date de fin</label>
        <input type="date" value={draft.date_fin ?? ""} onChange={(e) => setDraft({ ...draft, date_fin: e.target.value })} required />
        <label>Avancement (%)</label>
        <input
          type="number" min={0} max={100}
          value={draft.avancement ?? 0}
          onChange={(e) => setDraft({ ...draft, avancement: Number(e.target.value) })}
        />
        <label>Responsable</label>
        <select
          value={draft.responsable_id ?? ""}
          onChange={(e) => setDraft({ ...draft, responsable_id: e.target.value ? Number(e.target.value) : null })}
        >
          <option value="">—</option>
          {allUsers.map((u) => <option key={u.id} value={u.id}>{u.nom}</option>)}
        </select>
        <label>Statut</label>
        <select value={draft.statut} onChange={(e) => setDraft({ ...draft, statut: e.target.value as TaskStatus })}>
          {STATUTS.map((s) => <option key={s} value={s}>{TASK_STATUS_LABELS[s]}</option>)}
        </select>
        <button className="btn" type="submit">Ajouter</button>
      </form>

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
                    value={editDraft.statut ?? "prevu"}
                    onChange={(ev) => setEditDraft({ ...editDraft, statut: ev.target.value as TaskStatus })}
                  >
                    {STATUTS.map((s) => <option key={s} value={s}>{TASK_STATUS_LABELS[s]}</option>)}
                  </select>
                </td>
                <td>
                  <button className="btn" onClick={saveEdit}>Enregistrer</button>{" "}
                  <button className="btn secondary" onClick={cancelEdit}>Annuler</button>
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
                <td>
                  <button className="btn secondary" onClick={() => startEdit(t)}>Éditer</button>{" "}
                  <button className="btn danger" onClick={() => remove(t.id)}>Supprimer</button>
                </td>
              </tr>
            )
          )}
        </tbody>
      </table>
    </>
  );
}
