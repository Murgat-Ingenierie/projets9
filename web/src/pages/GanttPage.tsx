import { useEffect, useMemo, useState } from "react";
import { Gantt, Task as GanttTask, ViewMode } from "gantt-task-react";
import "gantt-task-react/dist/index.css";
import { epics, projects, tasks } from "../api/endpoints";
import { ErrorBanner } from "../components/ErrorBanner";
import type { Epic, Project, Task } from "../types";

// Palette alignée Material : primary (Indigo), accent (Blue), tertiary (Teal)
const EPIC_BG = "#3f51b5";
const EPIC_SELECTED = "#303f9f";
const PROJECT_BG = "#1976d2";
const PROJECT_SELECTED = "#0d47a1";
const TASK_BG = "#00897b";
const TASK_SELECTED = "#00695c";

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

function TaskListHeader({ headerHeight, rowWidth }: ListHeaderProps) {
  return (
    <div
      style={{
        height: headerHeight,
        width: rowWidth,
        fontFamily: "Roboto, sans-serif",
        fontSize: 12,
        fontWeight: 500,
        letterSpacing: "0.6px",
        textTransform: "uppercase",
        color: "#5f6368",
        display: "flex",
        alignItems: "center",
        paddingLeft: 16,
        borderBottom: "1px solid #e0e0e0",
        boxSizing: "border-box",
        background: "#fafafa",
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
  rowHeight,
  rowWidth,
  onExpanderClick,
}: ListTableProps) {
  return (
    <div style={{ fontFamily: "Roboto, sans-serif", fontSize: 14, width: rowWidth }}>
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
              paddingLeft: 16,
              borderBottom: "1px solid #f1f3f4",
              fontWeight: collapsible ? 500 : 400,
              boxSizing: "border-box",
              color: "#1f2329",
            }}
          >
            {collapsible ? (
              <span
                style={{
                  marginRight: 8,
                  fontSize: 10,
                  width: 16,
                  cursor: "pointer",
                  textAlign: "center",
                  userSelect: "none",
                  color: "#5f6368",
                }}
                onClick={() => onExpanderClick(t)}
              >
                {t.hideChildren ? "▶" : "▼"}
              </span>
            ) : (
              <span style={{ width: 24 }} />
            )}
            {editUrl ? (
              <a
                href={editUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: "#1976d2",
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
        background: "#1f2329",
        color: "white",
        padding: "10px 14px",
        borderRadius: 4,
        boxShadow: "0 4px 12px rgba(0,0,0,0.18)",
        fontSize: 13,
        fontFamily: "Roboto, sans-serif",
        maxWidth: 300,
      }}
    >
      <div style={{ fontWeight: 500, marginBottom: 4 }}>{task.name}</div>
      <div style={{ opacity: 0.85 }}>
        {fmtDate(task.start)} – {fmtDate(task.end)}
      </div>
      {task.progress > 0 && (
        <div style={{ opacity: 0.7, marginTop: 4 }}>Avancement : {task.progress}%</div>
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
