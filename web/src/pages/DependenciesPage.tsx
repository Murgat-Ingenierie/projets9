import { useEffect, useMemo, useState } from "react";
import { dependencies, tasks } from "../api/endpoints";
import { ErrorBanner } from "../components/ErrorBanner";
import { useSortableList } from "../hooks/useSort";
import type { Dependency, DependencyType, Task } from "../types";

const TYPES: DependencyType[] = ["FS", "SS", "FF"];
const TYPE_LABELS: Record<DependencyType, string> = {
  FS: "Fin → Début (FS)",
  SS: "Début → Début (SS)",
  FF: "Fin → Fin (FF)",
};

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

  const taskName = useMemo(() => {
    const m = new Map<number, string>();
    allTasks.forEach((t) => m.set(t.id, t.nom));
    return m;
  }, [allTasks]);

  const { sorted, sortHeader } = useSortableList(items);

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

  return (
    <>
      <h2>Dépendances</h2>
      <ErrorBanner error={err} />
      <p style={{ color: "#6b7280", fontSize: 13, marginBottom: 16 }}>
        Les dépendances ne sont pas éditables : pour la modifier, supprimez-la et créez-en une nouvelle.
      </p>
      <form className="form" onSubmit={create} style={{ marginBottom: 24 }}>
        <label>Tâche amont</label>
        <select
          value={draft.tache_amont_id ?? ""}
          onChange={(e) => setDraft({ ...draft, tache_amont_id: e.target.value ? Number(e.target.value) : undefined })}
          required
        >
          <option value="">—</option>
          {allTasks.map((t) => <option key={t.id} value={t.id}>{t.nom}</option>)}
        </select>
        <label>Tâche aval</label>
        <select
          value={draft.tache_aval_id ?? ""}
          onChange={(e) => setDraft({ ...draft, tache_aval_id: e.target.value ? Number(e.target.value) : undefined })}
          required
        >
          <option value="">—</option>
          {allTasks.map((t) => <option key={t.id} value={t.id}>{t.nom}</option>)}
        </select>
        <label>Type</label>
        <select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as DependencyType })}>
          {TYPES.map((s) => <option key={s} value={s}>{TYPE_LABELS[s]}</option>)}
        </select>
        <button className="btn" type="submit">Ajouter</button>
      </form>

      <table>
        <thead>
          <tr>
            {sortHeader("Amont", "amont", (d: Dependency) => taskName.get(d.tache_amont_id) ?? "")}
            {sortHeader("Aval", "aval", (d: Dependency) => taskName.get(d.tache_aval_id) ?? "")}
            {sortHeader("Type", "type", (d: Dependency) => d.type)}
            <th></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((d) => (
            <tr key={d.id}>
              <td>{taskName.get(d.tache_amont_id) ?? `tâche #${d.tache_amont_id}`}</td>
              <td>{taskName.get(d.tache_aval_id) ?? `tâche #${d.tache_aval_id}`}</td>
              <td>{TYPE_LABELS[d.type]}</td>
              <td><button className="btn danger" onClick={() => remove(d.id)}>Supprimer</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
