import { useEffect, useMemo, useState } from "react";
import { epics, projects, users } from "../api/endpoints";
import { ErrorBanner } from "../components/ErrorBanner";
import { useSortableList } from "../hooks/useSort";
import { PROJECT_STATUS_LABELS, fmtDate } from "../labels";
import type { Epic, Project, ProjectStatus, User } from "../types";

const STATUTS: ProjectStatus[] = ["prevu", "en_cours", "realise", "abandonne"];

export default function ProjectsPage() {
  const [items, setItems] = useState<Project[]>([]);
  const [allEpics, setAllEpics] = useState<Epic[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [err, setErr] = useState<unknown>(null);
  const [draft, setDraft] = useState<Partial<Project>>({
    epic_trigramme: "",
    nom: "",
    date_debut: "",
    date_fin: "",
    statut: "prevu",
  });
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

  const { sorted, sortHeader } = useSortableList(items);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      await projects.create(draft);
      setDraft({ epic_trigramme: "", nom: "", date_debut: "", date_fin: "", statut: "prevu" });
      load();
    } catch (e) {
      setErr(e);
    }
  }

  async function remove(id: number) {
    if (!confirm("Supprimer ce projet ?")) return;
    try {
      await projects.remove(id);
      load();
    } catch (e) {
      setErr(e);
    }
  }

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

  return (
    <>
      <h2>Projets</h2>
      <ErrorBanner error={err} />
      <form className="form" onSubmit={create} style={{ marginBottom: 24 }}>
        <label>Epic</label>
        <select
          value={draft.epic_trigramme}
          onChange={(e) => setDraft({ ...draft, epic_trigramme: e.target.value })}
          required
        >
          <option value="">—</option>
          {allEpics.map((e) => <option key={e.trigramme} value={e.trigramme}>{e.nom}</option>)}
        </select>
        <label>Nom</label>
        <input value={draft.nom ?? ""} onChange={(e) => setDraft({ ...draft, nom: e.target.value })} required />
        <label>Date de début</label>
        <input type="date" value={draft.date_debut ?? ""} onChange={(e) => setDraft({ ...draft, date_debut: e.target.value })} required />
        <label>Date de fin</label>
        <input type="date" value={draft.date_fin ?? ""} onChange={(e) => setDraft({ ...draft, date_fin: e.target.value })} required />
        <label>Responsable</label>
        <select
          value={draft.responsable_id ?? ""}
          onChange={(e) => setDraft({ ...draft, responsable_id: e.target.value ? Number(e.target.value) : null })}
        >
          <option value="">—</option>
          {allUsers.map((u) => <option key={u.id} value={u.id}>{u.nom}</option>)}
        </select>
        <label>Statut</label>
        <select value={draft.statut} onChange={(e) => setDraft({ ...draft, statut: e.target.value as ProjectStatus })}>
          {STATUTS.map((s) => <option key={s} value={s}>{PROJECT_STATUS_LABELS[s]}</option>)}
        </select>
        <button className="btn" type="submit">Ajouter</button>
      </form>

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
                <td>
                  <button className="btn" onClick={saveEdit}>Enregistrer</button>{" "}
                  <button className="btn secondary" onClick={cancelEdit}>Annuler</button>
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
                <td>
                  <button className="btn secondary" onClick={() => startEdit(p)}>Éditer</button>{" "}
                  <button className="btn danger" onClick={() => remove(p.id)}>Supprimer</button>
                </td>
              </tr>
            )
          )}
        </tbody>
      </table>
    </>
  );
}
