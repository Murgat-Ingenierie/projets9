import { useEffect, useMemo, useState } from "react";
import { Gantt, Task as GanttTask, ViewMode } from "gantt-task-react";
import "gantt-task-react/dist/index.css";
import { epics, projects, tasks } from "../api/endpoints";
import { ErrorBanner } from "../components/ErrorBanner";
import type { Epic, Project, Task } from "../types";

function toDate(s: string): Date {
  return new Date(s + "T00:00:00");
}

function fmtDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

type ListHeaderProps = {
  headerHeight: number;
  fontFamily: string;
  fontSize: string;
  rowWidth: string;
};

function TaskListHeader({ headerHeight, fontFamily, fontSize, rowWidth }: ListHeaderProps) {
  return (
    <div
      style={{
        height: headerHeight,
        width: rowWidth,
        fontFamily,
        fontSize,
        fontWeight: 600,
        display: "flex",
        alignItems: "center",
        paddingLeft: 12,
        borderBottom: "2px solid #e5e7eb",
        boxSizing: "border-box",
        background: "#f3f4f6",
      }}
    >
      Nom
    </div>
  );
}

type ListTableProps = {
  tasks: GanttTask[];
  fontFamily: string;
  fontSize: string;
  rowHeight: number;
  rowWidth: string;
  onExpanderClick: (t: GanttTask) => void;
};

function TaskListTable({
  tasks: rowTasks,
  fontFamily,
  fontSize,
  rowHeight,
  rowWidth,
  onExpanderClick,
}: ListTableProps) {
  return (
    <div style={{ fontFamily, fontSize, width: rowWidth }}>
      {rowTasks.map((t) => {
        const collapsible = t.hideChildren !== undefined;
        return (
          <div
            key={t.id}
            style={{
              height: rowHeight,
              display: "flex",
              alignItems: "center",
              paddingLeft: 12,
              borderBottom: "1px solid #f3f4f6",
              cursor: collapsible ? "pointer" : "default",
              fontWeight: collapsible ? 600 : 400,
              boxSizing: "border-box",
            }}
            onClick={() => collapsible && onExpanderClick(t)}
          >
            {collapsible ? (
              <span style={{ marginRight: 6, fontSize: 10, width: 12 }}>
                {t.hideChildren ? "▶" : "▼"}
              </span>
            ) : (
              <span style={{ width: 18 }} />
            )}
            <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {t.name}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function TooltipContent({ task }: { task: GanttTask }) {
  return (
    <div
      style={{
        background: "white",
        padding: "8px 12px",
        border: "1px solid #d1d5db",
        borderRadius: 4,
        boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
        fontSize: 13,
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{task.name}</div>
      <div>
        {fmtDate(task.start)} – {fmtDate(task.end)}
      </div>
      {task.progress > 0 && (
        <div style={{ color: "#6b7280", marginTop: 2 }}>Avancement : {task.progress}%</div>
      )}
    </div>
  );
}

export default function GanttPage() {
  const [epicsList, setEpics] = useState<Epic[]>([]);
  const [projectsList, setProjects] = useState<Project[]>([]);
  const [tasksList, setTasks] = useState<Task[]>([]);
  const [err, setErr] = useState<unknown>(null);
  const [view, setView] = useState<ViewMode>(ViewMode.Month);
  const [expandedEpics, setExpandedEpics] = useState<Set<string>>(new Set());

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
      const isExpanded = expandedEpics.has(e.trigramme);
      out.push({
        id: `epic-${e.trigramme}`,
        name: e.nom,
        type: "project",
        start,
        end,
        progress: 0,
        hideChildren: !isExpanded,
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
  }, [epicsList, projectsList, tasksList, expandedEpics]);

  function handleExpander(task: GanttTask) {
    if (!task.id.startsWith("epic-")) return;
    const tri = task.id.slice(5);
    setExpandedEpics((prev) => {
      const next = new Set(prev);
      if (next.has(tri)) next.delete(tri);
      else next.add(tri);
      return next;
    });
  }

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
        <p>Aucun projet planifié.</p>
      ) : (
        <Gantt
          tasks={ganttTasks}
          viewMode={view}
          locale="fr-FR"
          listCellWidth="320px"
          TaskListHeader={TaskListHeader}
          TaskListTable={TaskListTable}
          TooltipContent={TooltipContent}
          onExpanderClick={handleExpander}
        />
      )}
    </>
  );
}
