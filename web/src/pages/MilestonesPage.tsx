import { useEffect, useMemo, useState } from "react";
import { epics, milestones, projects } from "../api/endpoints";
import { ErrorBanner } from "../components/ErrorBanner";
import { useSortableList } from "../hooks/useSort";
import { fmtDate } from "../labels";
import type { Epic, Milestone, Project } from "../types";

export default function MilestonesPage() {
  const [items, setItems] = useState<Milestone[]>([]);
  const [allEpics, setAllEpics] = useState<Epic[]>([]);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [err, setErr] = useState<unknown>(null);
  const [parentType, setParentType] = useState<"epic" | "project">("epic");
  const [draft, setDraft] = useState<Partial<Milestone>>({
    nom: "",
    date: "",
    atteint: false,
    epic_trigramme: null,
    project_id: null,
  });
  const [editing, setEditing] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<Milestone>>({});

  function load() {
    Promise.all([milestones.list(), epics.list(), projects.list()])
      .then(([m, e, p]) => {
        setItems(m);
        setAllEpics(e);
        setAllProjects(p);
      })
      .catch(setErr);
  }
  useEffect(load, []);

  const epicName = useMemo(() => {
    const m = new Map<string, string>();
    allEpics.forEach((e) => m.set(e.trigramme, e.nom));
    return m;
  }, [allEpics]);
  const projectName = useMemo(() => {
    const m = new Map<number, string>();
    allProjects.forEach((p) => m.set(p.id, p.nom));
    return m;
  }, [allProjects]);

  const parentLabel = (m: Milestone) =>
    m.epic_trigramme
      ? epicName.get(m.epic_trigramme) ?? m.epic_trigramme
      : projectName.get(m.project_id ?? -1) ?? "";

  const { sorted, sortHeader } = useSortableList(items);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      const payload: Partial<Milestone> = {
        nom: draft.nom,
        date: draft.date,
        atteint: draft.atteint ?? false,
        epic_trigramme: parentType === "epic" ? draft.epic_trigramme : null,
        project_id: parentType === "project" ? draft.project_id : null,
      };
      await milestones.create(payload);
      setDraft({ nom: "", date: "", atteint: false, epic_trigramme: null, project_id: null });
      load();
    } catch (e) {
      setErr(e);
    }
  }

  async function remove(id: number) {
    if (!confirm("Supprimer ce jalon ?")) return;
    try {
      await milestones.remove(id);
      load();
    } catch (e) {
      setErr(e);
    }
  }

  function startEdit(m: Milestone) {
    setEditing(m.id);
    setEditDraft({ ...m });
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
      // L'API milestone.update ne change pas le parent : on n'envoie que les champs modifiables
      await milestones.update(editing, {
        nom: editDraft.nom,
        date: editDraft.date,
        atteint: editDraft.atteint,
      });
      cancelEdit();
      load();
    } catch (e) {
      setErr(e);
    }
  }

  return (
    <>
      <h2>Jalons</h2>
      <ErrorBanner error={err} />
      <form className="form" onSubmit={create} style={{ marginBottom: 24 }}>
        <label>Rattaché à</label>
        <select value={parentType} onChange={(e) => setParentType(e.target.value as "epic" | "project")}>
          <option value="epic">Un epic</option>
          <option value="project">Un projet</option>
        </select>
        {parentType === "epic" ? (
          <>
            <label>Epic</label>
            <select
              value={draft.epic_trigramme ?? ""}
              onChange={(e) => setDraft({ ...draft, epic_trigramme: e.target.value || null })}
              required
            >
              <option value="">—</option>
              {allEpics.map((e) => <option key={e.trigramme} value={e.trigramme}>{e.nom}</option>)}
            </select>
          </>
        ) : (
          <>
            <label>Projet</label>
            <select
              value={draft.project_id ?? ""}
              onChange={(e) => setDraft({ ...draft, project_id: e.target.value ? Number(e.target.value) : null })}
              required
            >
              <option value="">—</option>
              {allProjects.map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}
            </select>
          </>
        )}
        <label>Nom</label>
        <input value={draft.nom ?? ""} onChange={(e) => setDraft({ ...draft, nom: e.target.value })} required />
        <label>Date</label>
        <input type="date" value={draft.date ?? ""} onChange={(e) => setDraft({ ...draft, date: e.target.value })} required />
        <label>
          <input
            type="checkbox"
            checked={!!draft.atteint}
            onChange={(e) => setDraft({ ...draft, atteint: e.target.checked })}
          />
          {" "}Atteint
        </label>
        <button className="btn" type="submit">Ajouter</button>
      </form>

      <table>
        <thead>
          <tr>
            {sortHeader("Rattaché à", "parent", parentLabel)}
            {sortHeader("Nom", "nom", (m: Milestone) => m.nom)}
            {sortHeader("Date", "date", (m: Milestone) => m.date)}
            {sortHeader("Atteint", "atteint", (m: Milestone) => m.atteint ? 1 : 0)}
            <th></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((m) =>
            editing === m.id ? (
              <tr key={m.id} className="editing">
                <td>{parentLabel(m)}</td>
                <td>
                  <input
                    value={editDraft.nom ?? ""}
                    onChange={(ev) => setEditDraft({ ...editDraft, nom: ev.target.value })}
                  />
                </td>
                <td>
                  <input
                    type="date"
                    value={editDraft.date ?? ""}
                    onChange={(ev) => setEditDraft({ ...editDraft, date: ev.target.value })}
                  />
                </td>
                <td>
                  <input
                    type="checkbox"
                    checked={!!editDraft.atteint}
                    onChange={(ev) => setEditDraft({ ...editDraft, atteint: ev.target.checked })}
                  />
                </td>
                <td>
                  <button className="btn" onClick={saveEdit}>Enregistrer</button>{" "}
                  <button className="btn secondary" onClick={cancelEdit}>Annuler</button>
                </td>
              </tr>
            ) : (
              <tr key={m.id}>
                <td>{parentLabel(m)}</td>
                <td>{m.nom}</td>
                <td>{fmtDate(m.date)}</td>
                <td>{m.atteint ? "Oui" : "Non"}</td>
                <td>
                  <button className="btn secondary" onClick={() => startEdit(m)}>Éditer</button>{" "}
                  <button className="btn danger" onClick={() => remove(m.id)}>Supprimer</button>
                </td>
              </tr>
            )
          )}
        </tbody>
      </table>
    </>
  );
}
