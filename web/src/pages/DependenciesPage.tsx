import { useEffect, useState } from "react";
import { dependencies, tasks } from "../api/endpoints";
import { ErrorBanner } from "../components/ErrorBanner";
import type { Dependency, DependencyType, Task } from "../types";

const TYPES: DependencyType[] = ["FS", "SS", "FF"];

export default function DependenciesPage() {
  const [items, setItems] = useState<Dependency[]>([]);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [err, setErr] = useState<unknown>(null);
  const [draft, setDraft] = useState<Partial<Dependency>>({ type: "FS" });

  function load() {
    Promise.all([dependencies.list(), tasks.list()])
      .then(([d, t]) => {
        setItems(d);
        setAllTasks(t);
      })
      .catch(setErr);
  }
  useEffect(load, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      await dependencies.create(draft);
      setDraft({ type: "FS" });
      load();
    } catch (e) {
      setErr(e);
    }
  }

  async function remove(id: number) {
    if (!confirm("Supprimer cette dépendance ?")) return;
    try {
      await dependencies.remove(id);
      load();
    } catch (e) {
      setErr(e);
    }
  }

  function label(taskId: number) {
    const t = allTasks.find((x) => x.id === taskId);
    return t ? `#${t.id} ${t.nom}` : `#${taskId}`;
  }

  return (
    <>
      <h2>Dépendances</h2>
      <ErrorBanner error={err} />
      <form className="form" onSubmit={create} style={{ marginBottom: 24 }}>
        <label>Tâche amont</label>
        <select
          value={draft.tache_amont_id ?? ""}
          onChange={(e) =>
            setDraft({
              ...draft,
              tache_amont_id: e.target.value ? Number(e.target.value) : undefined,
            })
          }
          required
        >
          <option value="">—</option>
          {allTasks.map((t) => (
            <option key={t.id} value={t.id}>{label(t.id)}</option>
          ))}
        </select>
        <label>Tâche aval</label>
        <select
          value={draft.tache_aval_id ?? ""}
          onChange={(e) =>
            setDraft({
              ...draft,
              tache_aval_id: e.target.value ? Number(e.target.value) : undefined,
            })
          }
          required
        >
          <option value="">—</option>
          {allTasks.map((t) => (
            <option key={t.id} value={t.id}>{label(t.id)}</option>
          ))}
        </select>
        <label>Type</label>
        <select
          value={draft.type}
          onChange={(e) => setDraft({ ...draft, type: e.target.value as DependencyType })}
        >
          {TYPES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <button className="btn" type="submit">Ajouter</button>
      </form>

      <table>
        <thead>
          <tr><th>ID</th><th>Amont</th><th>Aval</th><th>Type</th><th></th></tr>
        </thead>
        <tbody>
          {items.map((d) => (
            <tr key={d.id}>
              <td>{d.id}</td>
              <td>{label(d.tache_amont_id)}</td>
              <td>{label(d.tache_aval_id)}</td>
              <td>{d.type}</td>
              <td><button className="btn danger" onClick={() => remove(d.id)}>Supprimer</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
