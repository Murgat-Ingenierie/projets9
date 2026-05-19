import { useEffect, useMemo, useState } from "react";
import { Gantt, Task as GanttTask, ViewMode } from "gantt-task-react";
import "gantt-task-react/dist/index.css";
import { epics, projects, tasks } from "../api/endpoints";
import { ErrorBanner } from "../components/ErrorBanner";
import type { Epic, Project, Task } from "../types";

const EPIC_BG = "#4f46e5";
const EPIC_SELECTED = "#3730a3";
const PROJECT_BG = "#2563eb";
const PROJECT_SELECTED = "#1d4ed8";
const TASK_BG = "#10b981";
const TASK_SELECTED = "#047857";

const EPIC_STYLES = {
  backgroundColor: EPIC_BG,
  backgroundSelectedColor: EPIC_SELECTED,
  progressColor: EPIC_BG,
  progressSelectedColor: EPIC_SELECTED,
};
const PROJECT_STYLES = {
  backgroundColor: PROJECT_BG,
  backgroundSelectedColor: PROJECT_SELECTED,
  progressColor: PROJECT_BG,
  progressSelectedColor: PROJECT_SELECTED,
};
const TASK_STYLES = {
  backgroundColor: TASK_BG,
  backgroundSelectedColor: TASK_SELECTED,
  progressColor: TASK_BG,
  progressSelectedColor: TASK_SELECTED,
};

const COLUMN_WIDTH_BY_VIEW: Partial<Record<ViewMode, number>> = {
  [ViewMode.Hour]: 30,
  [ViewMode.QuarterDay]: 60,
  [ViewMode.HalfDay]: 60,
  [ViewMode.Day]: 60,
  [ViewMode.Week]: 250,
  [ViewMode.Month]: 130,
  [ViewMode.Year]: 220,
};

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

function editUrlFor(t: GanttTask): string | null {
  if (t.id.startsWith("epic-")) return `/epics/${t.id.slice(5)}/edit`;
  if (t.id.startsWith("proj-")) return `/projects/${t.id.slice(5)}/edit`;
  return null;
}

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
        const editUrl = editUrlFor(t);
        return (
          <div
            key={t.id}
            style={{
              height: rowHeight,
              display: "flex",
              alignItems: "center",
              paddingLeft: 12,
              borderBottom: "1px solid #f3f4f6",
              fontWeight: collapsible ? 600 : 400,
              boxSizing: "border-box",
            }}
          >
            {collapsible ? (
              <span
                style={{
                  marginRight: 6,
                  fontSize: 10,
                  width: 16,
                  cursor: "pointer",
                  textAlign: "center",
                  userSelect: "none",
                }}
                onClick={() => onExpanderClick(t)}
              >
                {t.hideChildren ? "▶" : "▼"}
              </span>
            ) : (
              <span style={{ width: 18 }} />
            )}
            {editUrl ? (
              <a
                href={editUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: "#1d4ed8",
                  textDecoration: "none",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  flex: 1,
                }}
                title="Ouvrir l'édition dans un nouvel onglet"
              >
                {t.name}
              </a>
            ) : (
              <span
                style={{
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {t.name}
              </span>
            )}
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
        styles: EPIC_STYLES,
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
          styles: PROJECT_STYLES,
        });
        const projTasks = tasksList.filter((t) => t.projet_id === p.id);
        for (const t of projTasks) {
          out.push({
            id: `task-${t.id}`,
            name: `  ${t.nom}`,
            type: "task",
            start: toDate(t.date_debut),
            end: toDate(t.date_fin),
            progress: 0,
            project: `epic-${e.trigramme}`,
            styles: TASK_STYLES,
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
        <span style={{ color: "#6b7280", fontSize: 12, marginLeft: 12 }}>
          Cliquez sur le nom d'un epic ou d'un projet pour l'éditer dans un nouvel onglet (▶/▼ pour replier).
        </span>
      </div>
      {ganttTasks.length === 0 ? (
        <p>Aucun projet planifié.</p>
      ) : (
        <Gantt
          tasks={ganttTasks}
          viewMode={view}
          locale="fr-FR"
          listCellWidth="320px"
          columnWidth={COLUMN_WIDTH_BY_VIEW[view] ?? 100}
          TaskListHeader={TaskListHeader}
          TaskListTable={TaskListTable}
          TooltipContent={TooltipContent}
          onExpanderClick={handleExpander}
        />
      )}
    </>
  );
}
