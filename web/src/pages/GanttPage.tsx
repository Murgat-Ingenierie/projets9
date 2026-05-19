import { useEffect, useMemo, useState } from "react";
import { Gantt, Task as GanttTask, ViewMode } from "gantt-task-react";
import "gantt-task-react/dist/index.css";
import { epics, projects, tasks } from "../api/endpoints";
import { ErrorBanner } from "../components/ErrorBanner";
import type { Epic, Project, Task } from "../types";

function toDate(s: string): Date {
  return new Date(s + "T00:00:00");
}

export default function GanttPage() {
  const [epicsList, setEpics] = useState<Epic[]>([]);
  const [projectsList, setProjects] = useState<Project[]>([]);
  const [tasksList, setTasks] = useState<Task[]>([]);
  const [err, setErr] = useState<unknown>(null);
  const [view, setView] = useState<ViewMode>(ViewMode.Week);

  useEffect(() => {
    Promise.all([epics.list(), projects.list(), tasks.list()])
      .then(([e, p, t]) => {
        setEpics(e);
        setProjects(p);
        setTasks(t);
      })
      .catch(setErr);
  }, []);

  const ganttTasks: GanttTask[] = useMemo(() => {
    const out: GanttTask[] = [];
    for (const e of epicsList) {
      const epicProjects = projectsList.filter((p) => p.epic_trigramme === e.trigramme);
      if (epicProjects.length === 0) continue;
      const start = epicProjects.reduce(
        (a, p) => (toDate(p.date_debut) < a ? toDate(p.date_debut) : a),
        toDate(epicProjects[0].date_debut)
      );
      const end = epicProjects.reduce(
        (a, p) => (toDate(p.date_fin) > a ? toDate(p.date_fin) : a),
        toDate(epicProjects[0].date_fin)
      );
      out.push({
        id: `epic-${e.trigramme}`,
        name: `${e.trigramme} — ${e.nom}`,
        type: "project",
        start,
        end,
        progress: 0,
        hideChildren: false,
      });
      for (const p of epicProjects) {
        out.push({
          id: `proj-${p.id}`,
          name: p.nom,
          type: "task",
          start: toDate(p.date_debut),
          end: toDate(p.date_fin),
          progress: 0,
          project: `epic-${e.trigramme}`,
        });
        const projTasks = tasksList.filter((t) => t.projet_id === p.id);
        for (const t of projTasks) {
          out.push({
            id: `task-${t.id}`,
            name: `  ${t.nom}`,
            type: "task",
            start: toDate(t.date_debut),
            end: toDate(t.date_fin),
            progress: t.avancement,
            project: `epic-${e.trigramme}`,
          });
        }
      }
    }
    return out;
  }, [epicsList, projectsList, tasksList]);

  return (
    <>
      <h2>Planning Gantt</h2>
      <ErrorBanner error={err} />
      <div className="toolbar">
        <label>Vue :</label>
        <select value={view} onChange={(e) => setView(e.target.value as ViewMode)}>
          <option value={ViewMode.Day}>Jour</option>
          <option value={ViewMode.Week}>Semaine</option>
          <option value={ViewMode.Month}>Mois</option>
        </select>
      </div>
      {ganttTasks.length === 0 ? (
        <p>Aucun projet planifié. Créez un projet pour le voir apparaître ici.</p>
      ) : (
        <Gantt tasks={ganttTasks} viewMode={view} locale="fr-FR" />
      )}
    </>
  );
}
