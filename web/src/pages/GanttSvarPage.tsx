// C9 Phase 2b — Nouveau planning bâti sur SVAR, construit EN PARALLÈLE de l'actuel
// (route non listée /planning-svar). Réutilise usePlanningData (Phase 1) et les
// mappings purs buildSvarTasks/buildSvarLinks. Incrément 1 : rendu lecture seule
// (hiérarchie + jalons + dépendances). Drag/persist, contrôles, décorations,
// undo, panneau : incréments suivants.
import { useMemo, useState } from "react";
import { Gantt, Willow } from "@svar-ui/react-gantt";
import "@svar-ui/react-gantt/all.css";
import { usePlanningData } from "../planning/usePlanningData";
import { buildSvarTasks } from "../planning/buildSvarTasks";
import { buildSvarLinks } from "../planning/buildSvarLinks";
import { ErrorBanner } from "../components/ErrorBanner";
import type { Task } from "../types";

const SCALES = [
  { unit: "month", step: 1, format: (d: Date) => d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" }) },
  { unit: "day", step: 1, format: (d: Date) => String(d.getDate()) },
];

export default function GanttSvarPage() {
  const [err, setErr] = useState<unknown>(null);
  const { epics, projects, tasks, dependencies, milestones } = usePlanningData({
    onError: setErr,
  });

  const tasksByProject = useMemo(() => {
    const m = new Map<number, Task[]>();
    for (const t of tasks) {
      if (!m.has(t.projet_id)) m.set(t.projet_id, []);
      m.get(t.projet_id)!.push(t);
    }
    return m;
  }, [tasks]);

  const svarTasks = useMemo(
    () =>
      buildSvarTasks({
        epics,
        projects,
        tasksByProject,
        milestones,
        teamFilterProjectIds: null,
        teamFilterTaskIds: null,
      }),
    [epics, projects, tasksByProject, milestones],
  );
  const svarLinks = useMemo(() => buildSvarLinks(dependencies), [dependencies]);

  return (
    <>
      <h2>Planning (SVAR) — aperçu Phase 2b</h2>
      <ErrorBanner error={err} />
      <div style={{ height: "82vh", border: "1px solid #e5e7eb" }}>
        <Willow>
          <Gantt tasks={svarTasks} links={svarLinks} scales={SCALES} cellWidth={36} />
        </Willow>
      </div>
    </>
  );
}
