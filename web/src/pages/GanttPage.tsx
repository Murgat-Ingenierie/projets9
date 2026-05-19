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
    // Pour éclaircir, on interpole vers 255 (évite l'effet "washé" du multiplicateur naïf)
    return Math.round(c + (255 - c) * (1 - 1 / factor));
  });
  return `#${channels.map((x) => Math.max(0, Math.min(255, x)).toString(16).padStart(2, "0")).join("")}`;
}

const darken = adjustBrightness;

function stylesFor(color: string) {
  return {
    backgroundColor: color,
    backgroundSelectedColor: darken(color, 0.8),
    progressColor: color,
    progressSelectedColor: darken(color, 0.8),
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
        const isEpic = t.id.startsWith("epic-");
        const isTask = t.id.startsWith("task-");
        const editUrl = editUrlFor(t);
        const indent = isEpic ? 0 : isTask ? 44 : 24;
        return (
          <div
            key={t.id}
            style={{
              height: rowHeight,
              display: "flex",
              alignItems: "center",
              paddingLeft: 12 + indent,
              borderBottom: "1px solid #f1f3f4",
              fontWeight: isEpic ? 600 : 400,
              boxSizing: "border-box",
              color: "#1f2329",
            }}
          >
            {isEpic ? (
              <span
                style={{
                  marginRight: 8,
                  fontSize: 11,
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
                  color: "#374151",
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
      const epicColor = e.couleur ?? DEFAULT_EPIC_COLOR;
      const projectColor = adjustBrightness(epicColor, 1.3);
      const taskColor = adjustBrightness(epicColor, 1.7);
      // Epic en type "task" pour barre uniforme (pas de triangles d'extrémité
      // qui causaient l'effet bicolore). On gère le repliage manuellement
      // côté React puisque la lib ignore hideChildren pour les "task".
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
          Cliquez sur le nom d'un epic ou projet pour l'éditer (▶/▼ pour replier).
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
            TaskListTable={TaskListTable}
            TooltipContent={TooltipContent}
            onExpanderClick={handleExpander}
          />
        </div>
      )}
    </>
  );
}
