import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { dependencies, tasks } from "../api/endpoints";
import { ErrorBanner } from "../components/ErrorBanner";
import { useSortableList } from "../hooks/useSort";
import type { Dependency, DependencyType, Task } from "../types";

const TYPE_LABELS: Record<DependencyType, string> = {
  FS: "Fin → Début (FS)",
  SS: "Début → Début (SS)",
  FF: "Fin → Fin (FF)",
};

export default function DependenciesPage() {
  const nav = useNavigate();
  const [items, setItems] = useState<Dependency[]>([]);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [err, setErr] = useState<unknown>(null);

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

  const { sorted, sortHeader, filteredCount, totalCount } = useSortableList(items);

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
      <div className="page-header">
        <h2>Dépendances</h2>
        <button className="btn" onClick={() => nav("/dependencies/new")}>+ Ajouter</button>
      </div>
      <ErrorBanner error={err} />
      <p className="muted">
        {filteredCount} sur {totalCount} — non éditables, supprimer puis recréer pour modifier.
      </p>

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
