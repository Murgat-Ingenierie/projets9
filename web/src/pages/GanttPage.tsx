import { useEffect, useMemo, useState } from "react";
import { Gantt, Task as GanttTask, ViewMode } from "gantt-task-react";
import "gantt-task-react/dist/index.css";
import { epics, projects, tasks } from "../api/endpoints";
import { EditPanel, type PanelTarget } from "../components/EditPanel";
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

function isoDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function fmtDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
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
      Projet · Tâche
    </div>
  );
}

export default function GanttPage() {
  const [epicsList, setEpics] = useState<Epic[]>([]);
  const [projectsList, setProjects] = useState<Project[]>([]);
  const [tasksList, setTasks] = useState<Task[]>([]);
  const [err, setErr] = useState<unknown>(null);
  const [view, setView] = useState<ViewMode>(ViewMode.Month);
  const [editMode, setEditMode] = useState(false);
  const [expandedProjects, setExpandedProjects] = useState<Set<number>>(new Set());
  const [panelTarget, setPanelTarget] = useState<PanelTarget | null>(null);

  function load() {
    Promise.all([epics.list(), projects.list(), tasks.list()])
      .then(([e, p, t]) => {
        setEpics(e);
        setProjects(p);
        setTasks(t);
      })
      .catch(setErr);
  }
  useEffect(load, []);

  function toggleProject(id: number) {
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleDateChange(task: GanttTask) {
    setErr(null);
    try {
      const date_debut = isoDate(task.start);
      const date_fin = isoDate(task.end);
      if (task.id.startsWith("proj-")) {
        const id = Number(task.id.slice(5));
        await projects.update(id, { date_debut, date_fin });
      } else if (task.id.startsWith("task-")) {
        const id = Number(task.id.slice(5));
        await tasks.update(id, { date_debut, date_fin });
      } else {
        return;
      }
      load();
    } catch (e) {
      setErr(e);
      load(); // rollback visuel
    }
  }

  const tasksByProject = useMemo(() => {
    const m = new Map<number, Task[]>();
    for (const t of tasksList) {
      if (!m.has(t.projet_id)) m.set(t.projet_id, []);
      m.get(t.projet_id)!.push(t);
    }
    // Ordre stable par id (= ordre de création) pour ne pas permuter
    // les lignes quand l'utilisateur drag une barre.
    for (const arr of m.values()) {
      arr.sort((a, b) => a.id - b.id);
    }
    return m;
  }, [tasksList]);

  const ganttTasks: GanttTask[] = useMemo(() => {
    const out: GanttTask[] = [];
    const epicByTri = new Map(epicsList.map((e) => [e.trigramme, e]));

    const byEpic = new Map<string, Project[]>();
    for (const p of projectsList) {
      if (!byEpic.has(p.epic_trigramme)) byEpic.set(p.epic_trigramme, []);
      byEpic.get(p.epic_trigramme)!.push(p);
    }

    const sortedTris = Array.from(byEpic.keys()).sort((a, b) => {
      const na = epicByTri.get(a)?.nom ?? a;
      const nb = epicByTri.get(b)?.nom ?? b;
      return na.localeCompare(nb, "fr", { sensitivity: "base" });
    });

    for (const tri of sortedTris) {
      const epic = epicByTri.get(tri);
      const epicProjects = byEpic.get(tri)!;
      if (epicProjects.length === 0) continue;
      const color = epic?.couleur ?? DEFAULT_EPIC_COLOR;
      const taskColor = adjustBrightness(color, 1.6);

      // Ordre stable par id pour ne pas permuter quand on drag une barre.
      const sortedProjects = [...epicProjects].sort((a, b) => a.id - b.id);
      for (const p of sortedProjects) {
        out.push({
          id: `proj-${p.id}`,
          name: p.nom,
          type: "task",
          start: toDate(p.date_debut),
          end: toDate(p.date_fin),
          progress: 0,
          isDisabled: !editMode,
          styles: stylesFor(color),
        });
        if (expandedProjects.has(p.id)) {
          const pTasks = tasksByProject.get(p.id) ?? [];
          for (const t of pTasks) {
            out.push({
              id: `task-${t.id}`,
              name: t.nom,
              type: "task",
              start: toDate(t.date_debut),
              end: toDate(t.date_fin),
              progress: 0,
              isDisabled: !editMode,
              styles: stylesFor(taskColor),
            });
          }
        }
      }
    }
    return out;
  }, [epicsList, projectsList, tasksByProject, expandedProjects, editMode]);

  const projectInfoById = useMemo(() => {
    const epicByTri = new Map(epicsList.map((e) => [e.trigramme, e]));
    const m = new Map<
      number,
      { color: string; epicName: string; trigramme: string; tasksCount: number; statut: string }
    >();
    for (const p of projectsList) {
      const epic = epicByTri.get(p.epic_trigramme);
      m.set(p.id, {
        color: epic?.couleur ?? DEFAULT_EPIC_COLOR,
        epicName: epic?.nom ?? p.epic_trigramme,
        trigramme: p.epic_trigramme,
        tasksCount: tasksByProject.get(p.id)?.length ?? 0,
        statut: p.statut,
      });
    }
    return m;
  }, [epicsList, projectsList, tasksByProject]);

  const taskStatutById = useMemo(() => {
    const m = new Map<number, string>();
    for (const t of tasksList) m.set(t.id, t.statut);
    return m;
  }, [tasksList]);

  function textColorFor(hex: string): string {
    const m = /^#([0-9a-f]{6})$/i.exec(hex);
    if (!m) return "#ffffff";
    const n = parseInt(m[1], 16);
    const r = (n >> 16) & 0xff;
    const g = (n >> 8) & 0xff;
    const b = n & 0xff;
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.62 ? "#1f2329" : "#ffffff";
  }

  function CustomTaskListTable(props: {
    tasks: GanttTask[];
    rowHeight: number;
    rowWidth: string;
  }) {
    return (
      <div style={{ fontFamily: "Roboto, sans-serif", fontSize: 14, width: props.rowWidth }}>
        {props.tasks.map((t) => {
          if (t.id.startsWith("task-")) {
            const taskId = Number(t.id.slice(5));
            const isDone = taskStatutById.get(taskId) === "realise";
            return (
              <div
                key={t.id}
                style={{
                  height: props.rowHeight,
                  display: "flex",
                  alignItems: "center",
                  paddingLeft: 64,
                  paddingRight: 12,
                  borderBottom: "1px solid #f1f3f4",
                  boxSizing: "border-box",
                  color: "#5f6368",
                  fontSize: 13,
                  gap: 6,
                }}
              >
                {isDone && (
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: 16, color: "#2e7d32" }}
                    title="Tâche réalisée"
                  >
                    check_circle
                  </span>
                )}
                <span
                  style={{
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    flex: 1,
                    textDecoration: isDone ? "line-through" : "none",
                  }}
                >
                  {t.name}
                </span>
                <button
                  type="button"
                  onClick={() => setPanelTarget({ type: "task", id: taskId })}
                  title="Éditer la tâche dans le panneau latéral"
                  style={{
                    background: "transparent",
                    border: 0,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    color: "#9aa0a6",
                    padding: 2,
                    borderRadius: 4,
                    transition: "color 180ms, background 180ms",
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
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                    edit
                  </span>
                </button>
              </div>
            );
          }
          // ligne de projet
          const projId = Number(t.id.slice(5));
          const info = projectInfoById.get(projId);
          const color = info?.color ?? DEFAULT_EPIC_COLOR;
          const epicName = info?.epicName ?? "";
          const trigramme = info?.trigramme ?? "";
          const tasksCount = info?.tasksCount ?? 0;
          const isExpanded = expandedProjects.has(projId);
          const isProjectDone = info?.statut === "realise";
          return (
            <div
              key={t.id}
              style={{
                height: props.rowHeight,
                display: "flex",
                alignItems: "center",
                paddingLeft: 12,
                paddingRight: 12,
                borderBottom: "1px solid #f1f3f4",
                boxSizing: "border-box",
                color: "#1f2329",
                gap: 10,
              }}
            >
              <button
                type="button"
                onClick={() => setPanelTarget({ type: "epic", trigramme })}
                title={`Éditer l'epic : ${epicName}`}
                style={{
                  background: color,
                  color: textColorFor(color),
                  padding: "3px 8px",
                  border: 0,
                  borderRadius: 4,
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: "0.6px",
                  cursor: "pointer",
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                  flexShrink: 0,
                  display: "inline-block",
                  transition: "filter 180ms",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.filter = "brightness(1.15)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.filter = "none";
                }}
              >
                {trigramme}
              </button>
              {tasksCount > 0 ? (
                <button
                  type="button"
                  onClick={() => toggleProject(projId)}
                  title={isExpanded ? "Replier les tâches" : `Voir ${tasksCount} tâche${tasksCount > 1 ? "s" : ""}`}
                  style={{
                    background: "transparent",
                    border: 0,
                    cursor: "pointer",
                    padding: 0,
                    width: 22,
                    height: 22,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#5f6368",
                    borderRadius: 4,
                    flexShrink: 0,
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                    {isExpanded ? "expand_more" : "chevron_right"}
                  </span>
                </button>
              ) : (
                <span style={{ width: 22, flexShrink: 0 }} />
              )}
              {isProjectDone && (
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: 18, color: "#2e7d32" }}
                  title="Projet réalisé"
                >
                  check_circle
                </span>
              )}
              <span
                style={{
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  flex: 1,
                  textDecoration: isProjectDone ? "line-through" : "none",
                }}
              >
                {t.name}
              </span>
              <button
                type="button"
                onClick={() => setPanelTarget({ type: "project", id: projId })}
                title="Éditer le projet dans le panneau latéral"
                style={{
                  background: "transparent",
                  border: 0,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  color: "#9aa0a6",
                  padding: 2,
                  borderRadius: 4,
                  transition: "color 180ms, background 180ms",
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
                  edit
                </span>
              </button>
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

  const todayPill = fmtDate(new Date());

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
        <button
          type="button"
          className={`chip ${editMode ? "active" : ""}`}
          onClick={() => setEditMode((v) => !v)}
          title="Permet de déplacer / redimensionner les barres en glissant"
          style={{ marginLeft: 12 }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 16, marginRight: 4 }}>
            {editMode ? "lock_open" : "lock"}
          </span>
          Édition
        </button>
        <span
          style={{
            marginLeft: 12,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 12px",
            background: "rgba(255, 152, 0, 0.15)",
            color: "#b75d00",
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 500,
            letterSpacing: "0.3px",
          }}
          title="La colonne du jour est surlignée en orange clair sur le Gantt"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>today</span>
          Aujourd'hui : {todayPill}
        </span>
        <span style={{ color: "#5f6368", fontSize: 12, marginLeft: "auto" }}>
          {editMode
            ? "Glissez une barre (projet ou tâche) pour la déplacer ou redimensionner."
            : "Cliquez ▶ pour voir les tâches d'un projet. ✏️ pour ouvrir l'édition dans le panneau."}
        </span>
      </div>
      {ganttTasks.length === 0 ? (
        <p>Aucun projet planifié.</p>
      ) : (
        <div className={`gantt-container ${editMode ? "edit-mode" : ""}`}>
          <Gantt
            tasks={ganttTasks}
            viewMode={view}
            locale="fr-FR"
            listCellWidth="380px"
            columnWidth={COLUMN_WIDTH_BY_VIEW[view] ?? 100}
            barFill={editMode ? 80 : 60}
            todayColor="rgba(255, 152, 0, 0.18)"
            TaskListHeader={TaskListHeader}
            TaskListTable={CustomTaskListTable}
            TooltipContent={TooltipContent}
            onDateChange={handleDateChange}
          />
        </div>
      )}
      <EditPanel target={panelTarget} onClose={() => setPanelTarget(null)} onSaved={load} />
    </>
  );
}
