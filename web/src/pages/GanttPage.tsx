import { useEffect, useMemo, useState } from "react";
import { Gantt, Task as GanttTask, ViewMode } from "gantt-task-react";
import "gantt-task-react/dist/index.css";
import { epics, projects, tasks } from "../api/endpoints";
import { ErrorBanner } from "../components/ErrorBanner";
import type { Epic, Project, Task } from "../types";

const DEFAULT_EPIC_COLOR = "#3f51b5";

function adjustBrightness(hex: string, factor: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const num = parseInt(m[1], 16);
  const channels = [(num >> 16) & 0xff, (num >> 8) & 0xff, num & 0xff].map((c) => {
    if (factor < 1) return Math.round(c * factor);
    return Math.round(c + (255 - c) * (1 - 1 / factor));
  });
  return `#${channels.map((x) => Math.max(0, Math.min(255, x)).toString(16).padStart(2, "0")).join("")}`;
}

function stylesFor(color: string) {
  return {
    backgroundColor: color,
    backgroundSelectedColor: adjustBrightness(color, 0.8),
    progressColor: color,
    progressSelectedColor: adjustBrightness(color, 0.8),
  };
}

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

function editUrlFor(id: string): string | null {
  if (id.startsWith("epic-")) return `/epics/${id.slice(5)}/edit`;
  if (id.startsWith("proj-")) return `/projects/${id.slice(5)}/edit`;
  return null;
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
    </div>
  );
}

function TaskListHeader({
  headerHeight,
  rowWidth,
}: {
  headerHeight: number;
  fontFamily: string;
  fontSize: string;
  rowWidth: string;
}) {
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

  function toggleEpic(trigramme: string) {
    setExpandedEpics((prev) => {
      const next = new Set(prev);
      if (next.has(trigramme)) next.delete(trigramme);
      else next.add(trigramme);
      return next;
    });
  }

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
      const epicColor = e.couleur ?? DEFAULT_EPIC_COLOR;
      const projectColor = adjustBrightness(epicColor, 1.3);
      const taskColor = adjustBrightness(epicColor, 1.7);
      out.push({
        id: `epic-${e.trigramme}`,
        name: e.nom,
        type: "task",
        start,
        end,
        progress: 0,
        hideChildren: !isExpanded,
        styles: stylesFor(epicColor),
      });
      if (!isExpanded) continue;
      for (const p of epicProjects) {
        out.push({
          id: `proj-${p.id}`,
          name: p.nom,
          type: "task",
          start: toDate(p.date_debut),
          end: toDate(p.date_fin),
          progress: 0,
          project: `epic-${e.trigramme}`,
          styles: stylesFor(projectColor),
        });
        const projTasks = tasksList.filter((t) => t.projet_id === p.id);
        for (const t of projTasks) {
          out.push({
            id: `task-${t.id}`,
            name: t.nom,
            type: "task",
            start: toDate(t.date_debut),
            end: toDate(t.date_fin),
            progress: 0,
            project: `epic-${e.trigramme}`,
            styles: stylesFor(taskColor),
          });
        }
      }
    }
    return out;
  }, [epicsList, projectsList, tasksList, expandedEpics]);

  // TaskListTable défini en interne pour avoir accès via closure à
  // toggleEpic / expandedEpics. On contourne ainsi le wrapper
  // onExpanderClick de la lib qui n'invoque pas le callback quand le
  // type est "task" + hideChildren se perd dans la conversion en BarTask.
  function CustomTaskListTable(props: {
    tasks: GanttTask[];
    rowHeight: number;
    rowWidth: string;
  }) {
    return (
      <div style={{ fontFamily: "Roboto, sans-serif", fontSize: 14, width: props.rowWidth }}>
        {props.tasks.map((t) => {
          const isEpic = t.id.startsWith("epic-");
          const isTask = t.id.startsWith("task-");
          const editUrl = editUrlFor(t.id);
          const indent = isEpic ? 0 : isTask ? 44 : 24;
          const collapsed = isEpic && !expandedEpics.has(t.id.slice(5));
          return (
            <div
              key={t.id}
              style={{
                height: props.rowHeight,
                display: "flex",
                alignItems: "center",
                paddingLeft: 12 + indent,
                paddingRight: 12,
                borderBottom: "1px solid #f1f3f4",
                fontWeight: isEpic ? 600 : 400,
                boxSizing: "border-box",
                color: "#1f2329",
              }}
            >
              {isEpic ? (
                <button
                  type="button"
                  onClick={() => toggleEpic(t.id.slice(5))}
                  style={{
                    marginRight: 8,
                    width: 24,
                    height: 24,
                    border: 0,
                    background: "transparent",
                    cursor: "pointer",
                    color: "#5f6368",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 4,
                    padding: 0,
                  }}
                  title={collapsed ? "Déplier" : "Replier"}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: 18 }}
                  >
                    {collapsed ? "chevron_right" : "expand_more"}
                  </span>
                </button>
              ) : (
                <span style={{ width: 32 }} />
              )}
              <span
                style={{
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  flex: 1,
                  color: "#1f2329",
                }}
              >
                {t.name}
              </span>
              {editUrl && (
                <a
                  href={editUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Ouvrir l'édition dans un nouvel onglet"
                  style={{
                    marginLeft: 6,
                    display: "inline-flex",
                    alignItems: "center",
                    color: "#9aa0a6",
                    padding: 2,
                    borderRadius: 4,
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.color = "#1976d2";
                    (e.currentTarget as HTMLElement).style.background = "#e3f2fd";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.color = "#9aa0a6";
                    (e.currentTarget as HTMLElement).style.background = "transparent";
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                    open_in_new
                  </span>
                </a>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  const VIEWS: { value: ViewMode; label: string }[] = [
    { value: ViewMode.Day, label: "Jour" },
    { value: ViewMode.Week, label: "Semaine" },
    { value: ViewMode.Month, label: "Mois" },
  ];

  return (
    <>
      <h2>Planning Gantt</h2>
      <ErrorBanner error={err} />
      <div className="toolbar">
        <div className="chip-group">
          {VIEWS.map((v) => (
            <button
              key={v.value}
              type="button"
              className={`chip ${view === v.value ? "active" : ""}`}
              onClick={() => setView(v.value)}
            >
              {v.label}
            </button>
          ))}
        </div>
        <span style={{ color: "#5f6368", fontSize: 12, marginLeft: "auto" }}>
          Cliquez sur l'icône ↗ à droite d'un nom pour l'ouvrir en édition.
        </span>
      </div>
      {ganttTasks.length === 0 ? (
        <p>Aucun projet planifié.</p>
      ) : (
        <div className="gantt-container">
          <Gantt
            tasks={ganttTasks}
            viewMode={view}
            locale="fr-FR"
            listCellWidth="320px"
            columnWidth={COLUMN_WIDTH_BY_VIEW[view] ?? 100}
            TaskListHeader={TaskListHeader}
            TaskListTable={CustomTaskListTable}
            TooltipContent={TooltipContent}
          />
        </div>
      )}
    </>
  );
}
