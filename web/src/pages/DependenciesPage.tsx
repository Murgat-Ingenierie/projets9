import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { dependencies, tasks } from "../api/endpoints";
import { Breadcrumb, type Crumb } from "../components/Breadcrumb";
import { ErrorBanner } from "../components/ErrorBanner";
import { useSortableList } from "../hooks/useSort";
import { navState } from "../hooks/useBreadcrumbState";
import type { Dependency, DependencyType, Task } from "../types";
import { BoutonSupprimer } from "../components/BoutonSupprimer";
import { useEstAdmin } from "../hooks/useEstAdmin";

const PARENT: Crumb[] = [{ label: "Planning", to: "/" }];
const SELF: Crumb = { label: "Dépendances", to: "/dependencies" };

const TYPE_LABELS: Record<DependencyType, string> = {
  FS: "Fin → Début (FS)",
  SS: "Début → Début (SS)",
  FF: "Fin → Fin (FF)",
};

export default function DependenciesPage() {
  const nav = useNavigate();
  const estAdmin = useEstAdmin();
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

  async function changerType(id: number, type: DependencyType) {
    setErr(null);
    try {
      await dependencies.update(id, type);
      load();
    } catch (e) {
      setErr(e);
    }
  }


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
      <Breadcrumb items={[...PARENT, { label: SELF.label }]} />
      <div className="page-header">
        <h2>Dépendances</h2>
        {/* Créer une dépendance est réservé aux administrateurs depuis le
            2026-08-04 : la suppression l'était déjà, et l'asymétrie piégeait les
            membres — ils traçaient un lien sans pouvoir le retirer. */}
        {estAdmin && (
          <button className="btn" onClick={() => nav("/dependencies/new", navState(PARENT, SELF))}>+ Ajouter</button>
        )}
      </div>
      <ErrorBanner error={err} />
      <p className="muted">
        {filteredCount} sur {totalCount}. Le <strong>type</strong> se change directement ;
        déplacer une extrémité demande toujours de supprimer puis recréer.
      </p>
      <p className="muted">
        Seules les dépendances <strong>Fin → Début</strong> décalent les tâches en cascade sur le
        planning. Une <em>Début → Début</em> ou une <em>Fin → Fin</em> est dessinée, mais ne
        déplace rien — changer le type change donc le comportement, pas seulement le libellé.
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
              <td>
                {/* Un seul champ modifiable : on enregistre au changement plutôt
                    que d'ouvrir un mode édition, qui coûterait deux clics de plus
                    pour choisir dans une liste de trois. */}
                {estAdmin ? (
                  <select
                    value={d.type}
                    onChange={(ev) => changerType(d.id, ev.target.value as DependencyType)}
                  >
                    {(Object.keys(TYPE_LABELS) as DependencyType[]).map((t) => (
                      <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                    ))}
                  </select>
                ) : (
                  TYPE_LABELS[d.type]
                )}
              </td>
              <td><BoutonSupprimer onClick={() => remove(d.id)} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
