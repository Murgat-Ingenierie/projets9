import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Gantt, Task as GanttTask, ViewMode } from "gantt-task-react";
import "gantt-task-react/dist/index.css";
import {
  dependencies as depsApi,
  epics,
  milestones as milestonesApi,
  projects,
  tasks,
} from "../api/endpoints";
import { EditPanel, type PanelTarget } from "../components/EditPanel";
import { IconButton } from "../components/IconButton";
import { ErrorBanner } from "../components/ErrorBanner";
import { navState } from "../hooks/useBreadcrumbState";
import type { Dependency, Epic, Milestone, Project, Task } from "../types";

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
        position: "sticky",
        top: 0,
        zIndex: 5,
      }}
    >
      Projet · Tâche
    </div>
  );
}

export default function GanttPage() {
  const nav = useNavigate();
  const [epicsList, setEpics] = useState<Epic[]>([]);
  const [projectsList, setProjects] = useState<Project[]>([]);
  const [tasksList, setTasks] = useState<Task[]>([]);
  const [err, setErr] = useState<unknown>(null);
  const [view, setView] = useState<ViewMode>(ViewMode.Month);
  const viewRef = useRef<ViewMode>(ViewMode.Month);
  useEffect(() => { viewRef.current = view; }, [view]);
  const [editMode, setEditMode] = useState(false);
  const [expandedProjects, setExpandedProjects] = useState<Set<number>>(new Set());
  const [panelTarget, setPanelTarget] = useState<PanelTarget | null>(null);
  const [allDeps, setAllDeps] = useState<Dependency[]>([]);
  const [allMilestones, setAllMilestones] = useState<Milestone[]>([]);
  const allMilestonesRef = useRef<Milestone[]>([]);
  allMilestonesRef.current = allMilestones;
  const projectsListRef = useRef<Project[]>([]);
  projectsListRef.current = projectsList;
  const tasksListRef = useRef<Task[]>([]);
  tasksListRef.current = tasksList;

  // Lien : handles visibles uniquement en mode édition. mousedown sur
  // un handle démarre le drag vers une autre tâche.
  const [linkSource, setLinkSource] = useState<string | null>(null);
  const [sourcePos, setSourcePos] = useState<{ x: number; y: number } | null>(null);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [linkHandles, setLinkHandles] = useState<
    { taskId: string; x: number; y: number }[]
  >([]);
  const [hoveredTargetRect, setHoveredTargetRect] = useState<
    { x: number; y: number; w: number; h: number } | null
  >(null);
  const ganttRef = useRef<HTMLDivElement>(null);
  const ganttTasksRef = useRef<GanttTask[]>([]);
  const linkSourceRefStable = useRef<string | null>(null);

  function load() {
    Promise.all([
      epics.list(),
      projects.list(),
      tasks.list(),
      depsApi.list(),
      milestonesApi.list(),
    ])
      .then(([e, p, t, d, m]) => {
        setEpics(e);
        setProjects(p);
        setTasks(t);
        setAllDeps(d);
        setAllMilestones(m);
      })
      .catch(setErr);
  }

  // Map aval_task_id → [amont_task_ids] pour piloter task.dependencies
  const depsByAval = useMemo(() => {
    const m = new Map<number, number[]>();
    for (const d of allDeps) {
      if (d.type !== "FS") continue;
      if (!m.has(d.tache_aval_id)) m.set(d.tache_aval_id, []);
      m.get(d.tache_aval_id)!.push(d.tache_amont_id);
    }
    return m;
  }, [allDeps]);

  // Recherche d'une dépendance par paire (amont, aval) — utilisé pour la
  // suppression au clic sur une flèche du Gantt.
  function findDepIdByPair(amontId: number, avalId: number): number | null {
    const d = allDeps.find(
      (x) => x.tache_amont_id === amontId && x.tache_aval_id === avalId && x.type === "FS"
    );
    return d?.id ?? null;
  }
  useEffect(load, []);

  // --- Mode Lier (drag depuis un handle visible sur chaque barre) ---
  function cancelLink() {
    linkSourceRefStable.current = null;
    setLinkSource(null);
    setSourcePos(null);
    setCursorPos(null);
    setHoveredTargetRect(null);
  }

  function startLinkDrag(taskId: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    linkSourceRefStable.current = taskId;
    setLinkSource(taskId);
    setSourcePos({ x: e.clientX, y: e.clientY });
    setCursorPos({ x: e.clientX, y: e.clientY });
  }

  // Listeners globaux mousemove/mouseup actifs uniquement pendant un drag
  useEffect(() => {
    if (!linkSource) return;

    function findTaskAtPoint(
      x: number,
      y: number
    ): { id: string; rect: DOMRect } | null {
      const root = ganttRef.current;
      if (!root) return null;
      let wrappers: NodeListOf<Element> | Element[] = root.querySelectorAll(
        "svg g[tabindex]"
      );
      if (wrappers.length === 0) {
        wrappers = root.querySelectorAll(
          '[class*="barWrapper"], [class*="taskItem"]'
        );
      }
      for (let i = 0; i < wrappers.length; i++) {
        const r = (wrappers[i] as HTMLElement).getBoundingClientRect();
        if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
          const tid = ganttTasksRef.current[i]?.id;
          if (tid?.startsWith("task-")) return { id: tid, rect: r };
        }
      }
      return null;
    }

    function onMove(e: MouseEvent) {
      setCursorPos({ x: e.clientX, y: e.clientY });
      const target = findTaskAtPoint(e.clientX, e.clientY);
      if (target && target.id !== linkSource) {
        setHoveredTargetRect({
          x: target.rect.left,
          y: target.rect.top,
          w: target.rect.width,
          h: target.rect.height,
        });
      } else {
        setHoveredTargetRect(null);
      }
    }
    function onUp(e: MouseEvent) {
      const src = linkSourceRefStable.current;
      if (!src) {
        cancelLink();
        return;
      }
      const target = findTaskAtPoint(e.clientX, e.clientY);
      if (!target || target.id === src) {
        cancelLink();
        return;
      }
      const amontId = Number(src.slice(5));
      const avalId = Number(target.id.slice(5));
      depsApi
        .create({ tache_amont_id: amontId, tache_aval_id: avalId, type: "FS" })
        .then(() => {
          cancelLink();
          load();
        })
        .catch((err) => {
          setErr(err);
          cancelLink();
        });
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") cancelLink();
    }

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.removeEventListener("keydown", onKey);
    };
  }, [linkSource]); // eslint-disable-line react-hooks/exhaustive-deps

  // Calendrier figé : on clone le <g class="calendar"> du SVG dans un
  // overlay SVG position:fixed quand l'original passe au-dessus du viewport.
  // L'approche transform sur place ne marchait pas (la lib re-render et/ou
  // un parent overflow nous coince) — la duplication contourne tout ça.
  const stickyOverlayRef = useRef<HTMLDivElement>(null);
  const milestoneTooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const MONTH_RE = /20\d\d|janv|f[ée]v|mars|avr|mai|juin|juil|ao[ûu]t|sept|oct|nov|d[ée]c/i;
    function findCalendar(root: HTMLElement): SVGGElement | null {
      const byClass = root.querySelector(
        'g[class*="calendar"], g[class*="Calendar"]'
      ) as SVGGElement | null;
      if (byClass) return byClass;
      const svg = root.querySelector("svg");
      if (!svg) return null;
      const gs = svg.querySelectorAll(":scope > g");
      for (const g of Array.from(gs)) {
        const text = (g.textContent || "").trim();
        if (text && MONTH_RE.test(text)) return g as SVGGElement;
      }
      return null;
    }

    function update() {
      const root = ganttRef.current;
      const overlay = stickyOverlayRef.current;
      if (!root || !overlay) return;

      const calendar = findCalendar(root);
      if (!calendar) return;
      const svg = calendar.ownerSVGElement;
      if (!svg) return;

      const calRect = calendar.getBoundingClientRect();
      const svgRect = svg.getBoundingClientRect();

      // Si la barre du bas du calendrier original est passée au-dessus
      // du viewport, on affiche le clone.
      if (calRect.bottom >= 0) {
        overlay.style.display = "none";
        return;
      }

      // L'overlay doit s'aligner sur le SVG du chart, PAS sur la
      // gantt-container (qui inclut aussi le panneau de gauche).
      overlay.style.display = "block";
      overlay.style.left = `${svgRect.left}px`;
      overlay.style.width = `${svgRect.width}px`;

      // Reconstruit un SVG clone en interne
      overlay.innerHTML = "";
      const ns = "http://www.w3.org/2000/svg";
      const cloneSvg = document.createElementNS(ns, "svg");
      cloneSvg.setAttribute("width", String(svgRect.width));
      cloneSvg.setAttribute("height", "50");
      cloneSvg.setAttribute("style", "display:block");
      const calClone = calendar.cloneNode(true) as SVGGElement;
      // On retire notre rect de fond éventuelle (si présente) — on
      // reposera celle de l'overlay.
      calClone.querySelector("[data-stick-bg]")?.remove();
      // Add background
      const bg = document.createElementNS(ns, "rect");
      bg.setAttribute("x", "0");
      bg.setAttribute("y", "0");
      bg.setAttribute("width", "100%");
      bg.setAttribute("height", "50");
      bg.setAttribute("fill", "#fafafa");
      bg.setAttribute("stroke", "#e0e0e0");
      bg.setAttribute("stroke-width", "1");
      cloneSvg.appendChild(bg);
      cloneSvg.appendChild(calClone);
      overlay.appendChild(cloneSvg);
    }

    let raf = requestAnimationFrame(update);
    const interval = setInterval(update, 250);
    document.addEventListener("scroll", update, { capture: true, passive: true });
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(interval);
      document.removeEventListener(
        "scroll",
        update,
        { capture: true } as EventListenerOptions
      );
      window.removeEventListener("resize", update);
    };
  }, []);

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

    // Swimlane jalons : UNE seule ligne d'ancre (anchor = jalon le plus tôt),
    // les autres jalons sont rendus manuellement via update() à leur x calculé
    // depuis columnWidth + viewMode. Permet une swimlane unique avec collision
    // detection sur les noms.
    const sortedMs = [...allMilestones].sort((a, b) => a.date.localeCompare(b.date));
    const MILESTONE_COLOR = "#f57c00";
    if (sortedMs.length > 0) {
      out.push({
        id: "milestone-anchor",
        name: "Jalons",
        type: "milestone",
        start: toDate(sortedMs[0].date),
        end: toDate(sortedMs[0].date),
        progress: 0,
        isDisabled: true,
        styles: {
          backgroundColor: MILESTONE_COLOR,
          backgroundSelectedColor: MILESTONE_COLOR,
          progressColor: MILESTONE_COLOR,
          progressSelectedColor: MILESTONE_COLOR,
        },
      });
    }

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
            const dependsOn = depsByAval.get(t.id) ?? [];
            out.push({
              id: `task-${t.id}`,
              name: t.nom,
              type: "task",
              start: toDate(t.date_debut),
              end: toDate(t.date_fin),
              progress: 0,
              isDisabled: !editMode,
              styles: stylesFor(taskColor),
              dependencies: dependsOn.map((amontId) => `task-${amontId}`),
            });
          }
        }
      }
    }
    return out;
  }, [epicsList, projectsList, tasksByProject, expandedProjects, editMode, depsByAval, allMilestones]);
  ganttTasksRef.current = ganttTasks;

  // Liste des flèches dans l'ordre où la lib les rend (pour les clics
  // sur la flèche → trouver la dépendance correspondante).
  const arrowPairs = useMemo(() => {
    const pairs: { depId: number; amontId: number; avalId: number }[] = [];
    for (const t of ganttTasks) {
      if (!t.id.startsWith("task-") || !t.dependencies) continue;
      const avalId = Number(t.id.slice(5));
      for (const amontIdRaw of t.dependencies) {
        if (!amontIdRaw.startsWith("task-")) continue;
        const amontId = Number(amontIdRaw.slice(5));
        const depId = findDepIdByPair(amontId, avalId);
        if (depId != null) pairs.push({ depId, amontId, avalId });
      }
    }
    return pairs;
  }, [ganttTasks, allDeps]);

  // Clic sur une flèche en mode édition → confirmation + suppression.
  useEffect(() => {
    if (!editMode) return;
    const root = ganttRef.current;
    if (!root) return;

    function onClick(e: MouseEvent) {
      let el = e.target as Element | null;
      let arrowEl: SVGGElement | null = null;
      // On cherche le PREMIER ancêtre <g> dont la classe contient
      // exactement "arrow" comme mot (pas "arrows" qui est le parent).
      while (el && el !== root) {
        if ((el as HTMLElement).tagName?.toLowerCase() === "g") {
          const cls = (el as HTMLElement).getAttribute("class") || "";
          const words = cls.split(/\s+/);
          if (words.includes("arrow")) {
            arrowEl = el as unknown as SVGGElement;
            break;
          }
        }
        el = el.parentElement;
      }
      if (!arrowEl) return;
      const arrows = root!.querySelectorAll('g[class~="arrow"]');
      const idx = Array.from(arrows).indexOf(arrowEl);
      if (idx < 0) return;
      const pair = arrowPairs[idx];
      if (!pair) return;
      e.preventDefault();
      e.stopPropagation();
      if (!confirm("Supprimer cette dépendance ?")) return;
      depsApi
        .remove(pair.depId)
        .then(load)
        .catch(setErr);
    }

    root.addEventListener("click", onClick);
    return () => root.removeEventListener("click", onClick);
  }, [editMode, arrowPairs]); // eslint-disable-line react-hooks/exhaustive-deps

  // Position des handles "Lier" : un par tâche, sur le côté droit de sa barre.
  useEffect(() => {
    if (!editMode) {
      setLinkHandles([]);
      return;
    }
    function computeHandles() {
      const root = ganttRef.current;
      if (!root) return;
      // Les barres sont les <g> focusables du SVG (tabindex présent).
      // Fallback class si jamais.
      let bars: NodeListOf<Element> | Element[] = root.querySelectorAll("svg g[tabindex]");
      if (bars.length === 0) {
        bars = root.querySelectorAll(
          'g[class*="barWrapper"], g[class*="taskItem"], g.barWrapper, g.taskItem'
        );
      }
      const out: { taskId: string; x: number; y: number }[] = [];
      Array.from(bars).forEach((bar, i) => {
        const id = ganttTasksRef.current[i]?.id;
        if (!id || !id.startsWith("task-")) return;
        const r = (bar as HTMLElement).getBoundingClientRect();
        if (r.width < 4 || r.height < 4) return;
        out.push({
          taskId: id,
          x: r.right - 12,
          y: r.top + r.height / 2,
        });
      });
      setLinkHandles(out);
    }
    let raf = requestAnimationFrame(computeHandles);
    function onScrollOrResize() {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(computeHandles);
    }
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    const interval = setInterval(computeHandles, 500); // catch lib internal updates
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(interval);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [editMode, ganttTasks]);

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

  const taskInfoById = useMemo(() => {
    const m = new Map<number, { statut: string }>();
    for (const t of tasksList) m.set(t.id, { statut: t.statut });
    return m;
  }, [tasksList]);

  // Tableau parallèle à ganttTasks indiquant si chaque ligne est "finie".
  // Tâche : statut = archive. Projet : statut = realise.
  const doneByIndex = useMemo(() => {
    return ganttTasks.map((t) => {
      if (t.id.startsWith("task-")) {
        const info = taskInfoById.get(Number(t.id.slice(5)));
        return info?.statut === "archive";
      }
      if (t.id.startsWith("proj-")) {
        const info = projectInfoById.get(Number(t.id.slice(5)));
        return info?.statut === "realise";
      }
      return false;
    });
  }, [ganttTasks, taskInfoById, projectInfoById]);
  const doneByIndexRef = useRef<boolean[]>([]);
  doneByIndexRef.current = doneByIndex;

  // Tableau parallèle indiquant si une barre de PROJET a au moins une tâche
  // sortant de sa fenêtre. INV-9 a été retiré : on signale visuellement par
  // une hachure rouge sur le projet (pas sur la tâche), sans bloquer.
  const outsideProjectByIndex = useMemo(() => {
    const projById = new Map<number, Project>();
    for (const p of projectsList) projById.set(p.id, p);
    const projMismatch = new Set<number>();
    for (const t of tasksList) {
      const proj = projById.get(t.projet_id);
      if (!proj) continue;
      if (t.date_debut < proj.date_debut || t.date_fin > proj.date_fin) {
        projMismatch.add(t.projet_id);
      }
    }
    return ganttTasks.map((g) => {
      if (!g.id.startsWith("proj-")) return false;
      return projMismatch.has(Number(g.id.slice(5)));
    });
  }, [ganttTasks, projectsList, tasksList]);
  const outsideProjectByIndexRef = useRef<boolean[]>([]);
  outsideProjectByIndexRef.current = outsideProjectByIndex;

  // Au premier rendu après chargement, scroll la fenêtre planning sur le mois
  // courant (today). On lit la position x du rect "today" injecté par la lib.
  const initialScrollDoneRef = useRef(false);
  useEffect(() => {
    if (initialScrollDoneRef.current) return;
    if (ganttTasks.length === 0) return;
    const t = setTimeout(() => {
      const root = ganttRef.current;
      if (!root) return;
      const scroller = Array.from(root.querySelectorAll<HTMLElement>("div")).find(
        (d) => {
          const s = getComputedStyle(d);
          return (
            (s.overflowX === "auto" || s.overflowX === "scroll") &&
            d.scrollWidth > d.clientWidth
          );
        }
      );
      if (!scroller) return;
      const todayRect = Array.from(
        root.querySelectorAll<SVGRectElement>("svg rect")
      ).find((r) => (r.getAttribute("fill") || "").includes("255, 152, 0"));
      if (!todayRect) return;
      const tx = parseFloat(todayRect.getAttribute("x") || "0");
      scroller.scrollLeft = Math.max(0, tx - 20);
      initialScrollDoneRef.current = true;
    }, 300);
    return () => clearTimeout(t);
  }, [ganttTasks]);

  // Mise en valeur des items finis (option C) :
  //  - fond de la barre à 40 % d'opacité (aplatissement visuel)
  //  - contour vert success 2 px
  //  - gros ✓ blanc au début de la barre
  useEffect(() => {
    const GREEN = "#2e7d32";
    function update() {
      const root = ganttRef.current;
      if (!root) return;
      // gantt-task-react rend 2 svgs : header calendrier (petit) et chart (grand).
      // On cible le chart : celui qui contient les barres g[tabindex].
      const svgs = Array.from(root.querySelectorAll("svg"));
      const svg = svgs.find((s) => s.querySelector("g[tabindex]")) ?? svgs[0];
      if (!svg) return;
      const ns = "http://www.w3.org/2000/svg";

      // Pattern de hachure rouge pour signaler les tâches hors-fenêtre projet
      let defs = svg.querySelector("defs");
      if (!defs) {
        defs = document.createElementNS(ns, "defs");
        svg.insertBefore(defs, svg.firstChild);
      }
      if (!defs.querySelector("#hatch-red")) {
        const pattern = document.createElementNS(ns, "pattern");
        pattern.setAttribute("id", "hatch-red");
        pattern.setAttribute("patternUnits", "userSpaceOnUse");
        pattern.setAttribute("width", "6");
        pattern.setAttribute("height", "6");
        pattern.setAttribute("patternTransform", "rotate(45)");
        const line = document.createElementNS(ns, "line");
        line.setAttribute("x1", "0");
        line.setAttribute("y1", "0");
        line.setAttribute("x2", "0");
        line.setAttribute("y2", "6");
        line.setAttribute("stroke", "#d32f2f");
        line.setAttribute("stroke-width", "2.5");
        line.setAttribute("opacity", "0.85");
        pattern.appendChild(line);
        defs.appendChild(pattern);
      }

      const MIN_W = 28; // seuil purement esthétique pour le stroke vert
      const bars = root.querySelectorAll("svg g[tabindex]");
      bars.forEach((bar, i) => {
        const isDone = doneByIndexRef.current[i];
        const isOutside = outsideProjectByIndexRef.current[i];
        const mainRect = bar.querySelector("rect");
        if (!mainRect) return;
        let check = bar.querySelector('[data-done-check]') as SVGGElement | null;
        if (check && check.tagName.toLowerCase() !== "g") {
          check.remove();
          check = null;
        }

        const w = parseFloat(mainRect.getAttribute("width") || "0");
        const x = parseFloat(mainRect.getAttribute("x") || "0");
        const y = parseFloat(mainRect.getAttribute("y") || "0");
        const h = parseFloat(mainRect.getAttribute("height") || "0");

        // Hachure rouge si la tâche sort de la fenêtre de son projet
        let hatch = bar.querySelector('[data-outside-hatch]') as SVGRectElement | null;
        if (isOutside) {
          if (!hatch) {
            hatch = document.createElementNS(ns, "rect") as SVGRectElement;
            hatch.setAttribute("data-outside-hatch", "true");
            hatch.setAttribute("fill", "url(#hatch-red)");
            hatch.setAttribute("pointer-events", "none");
            hatch.setAttribute("rx", "3");
            hatch.setAttribute("ry", "3");
            // Insère AVANT la coche done éventuelle pour que celle-ci reste au-dessus
            if (check) bar.insertBefore(hatch, check);
            else bar.appendChild(hatch);
          }
          hatch.setAttribute("x", String(x));
          hatch.setAttribute("y", String(y));
          hatch.setAttribute("width", String(w));
          hatch.setAttribute("height", String(h));
        } else if (hatch) {
          hatch.remove();
        }

        // Fade sur toutes les barres terminées ; stroke vert si assez large
        if (isDone) {
          mainRect.setAttribute("fill-opacity", "0.4");
          if (w >= MIN_W) {
            mainRect.setAttribute("stroke", GREEN);
            mainRect.setAttribute("stroke-width", "2");
          } else {
            mainRect.removeAttribute("stroke");
            mainRect.removeAttribute("stroke-width");
          }
        } else {
          mainRect.setAttribute("fill-opacity", "1");
          mainRect.removeAttribute("stroke");
          mainRect.removeAttribute("stroke-width");
        }

        // Label rendu par la lib : <text> frère du <g[tabindex]>, pas enfant
        const parent = bar.parentElement;
        const libLabels = parent
          ? (Array.from(parent.children).filter(
              (c) => c.tagName.toLowerCase() === "text"
            ) as SVGTextElement[])
          : [];
        libLabels.forEach((lbl) => lbl.setAttribute("dominant-baseline", "central"));

        // Mesure si le label de la lib est rendu À DROITE de la barre (hors barre)
        // ou À L'INTÉRIEUR. Critère = position naturelle du label vs fin de la barre.
        const lbl0 = libLabels[0];
        let labelOutsideRight = false;
        if (lbl0) {
          const lb = lbl0.getBoundingClientRect();
          const rb = mainRect.getBoundingClientRect();
          // Soustrais le translate qu'on a peut-être posé au tick précédent
          let trDx = 0;
          const tr = lbl0.getAttribute("transform");
          if (tr) {
            const m = /translate\(\s*(-?[\d.]+)/.exec(tr);
            if (m) trDx = parseFloat(m[1]);
          }
          labelOutsideRight = lb.left - trDx >= rb.right - 1;
        }
        const placeInside = !labelOutsideRight;

        if (isDone) {
          if (!check) {
            check = document.createElementNS(ns, "g") as SVGGElement;
            check.setAttribute("data-done-check", "true");
            check.setAttribute("pointer-events", "none");

            const txt = document.createElementNS(ns, "text");
            txt.setAttribute("font-family", "Material Symbols Outlined");
            txt.setAttribute("font-weight", "500");
            txt.setAttribute("fill", GREEN);
            txt.setAttribute("text-anchor", "middle");
            txt.setAttribute("dominant-baseline", "central");
            txt.setAttribute("font-size", "20");
            txt.textContent = "check_circle";
            check.appendChild(txt);
            bar.appendChild(check);
          }

          const size = placeInside
            ? Math.max(12, Math.min(h * 0.85, 22))
            : Math.max(12, Math.min(h * 0.85, 16));
          const scale = size / 20;
          const cy = y + h / 2;
          const cx = placeInside ? x + size / 2 + 4 : x + w + size / 2 + 3;
          check.setAttribute("transform", `translate(${cx}, ${cy}) scale(${scale})`);

          // Décalage du label seulement quand il est rendu DEHORS, pour ménager la coche
          libLabels.forEach((lbl) => {
            if (!placeInside) {
              lbl.setAttribute("transform", `translate(${size + 6}, 0)`);
            } else {
              lbl.removeAttribute("transform");
            }
          });
        } else {
          if (check) check.remove();
          libLabels.forEach((lbl) => lbl.removeAttribute("transform"));
        }
      });

      // === Swimlane jalons unique + lignes verticales avec tooltip ===
      const ms = allMilestonesRef.current.slice().sort((a, b) => a.date.localeCompare(b.date));
      const anchorIdx = ganttTasksRef.current.findIndex((t) => t.id === "milestone-anchor");
      const anchorBar = anchorIdx >= 0 ? (bars[anchorIdx] as SVGGElement | undefined) : undefined;
      const anchorRect = anchorBar?.querySelector("rect") ?? null;

      const svgH =
        parseFloat(svg.getAttribute("height") || "0") ||
        svg.getBoundingClientRect().height ||
        0;

      // Cleanup si pas de jalons
      if (!anchorRect || ms.length === 0) {
        svg.querySelector("[data-milestone-lane]")?.remove();
        svg.querySelector("[data-milestone-lines]")?.remove();
      } else {
        // Masque le diamant rendu par la lib (anchor)
        (anchorRect as SVGRectElement).style.display = "none";

        const anchorX = parseFloat(anchorRect.getAttribute("x") || "0");
        const anchorY = parseFloat(anchorRect.getAttribute("y") || "0");
        const anchorH = parseFloat(anchorRect.getAttribute("height") || "0");

        // Centre Y de la swimlane = centre Y de la ligne où le diamant aurait été placé
        // (anchor est un milestone -> rect placé au centre vertical de la ligne).
        // On reprend la position telle quelle.
        const rowMidY = anchorY + anchorH / 2;
        // rowHeight estimée depuis la barre suivante (différence d'y) si dispo,
        // sinon valeur par défaut de gantt-task-react.
        let rowHeight = 50;
        const nextBar = bars[anchorIdx + 1];
        const nextRect = nextBar?.querySelector("rect");
        if (nextRect) {
          const nextY = parseFloat(nextRect.getAttribute("y") || "0");
          // Pour une milestone, anchorY est le top du diamant ;
          // pour une tâche, y est le top du bar avec un petit padding.
          // L'écart entre les centres = rowHeight.
          const nextH = parseFloat(nextRect.getAttribute("height") || "0");
          const dy = nextY + nextH / 2 - rowMidY;
          if (dy > 10) rowHeight = dy;
        }
        const laneTop = rowMidY - rowHeight / 2;

        // Conversion date → x via columnWidth + viewMode
        const currentView = viewRef.current;
        const columnW = COLUMN_WIDTH_BY_VIEW[currentView] ?? 100;
        const ppd = (() => {
          switch (currentView) {
            case ViewMode.Hour: return columnW * 24;
            case ViewMode.QuarterDay: return columnW * 4;
            case ViewMode.HalfDay: return columnW * 2;
            case ViewMode.Day: return columnW;
            case ViewMode.Week: return columnW / 7;
            case ViewMode.Month: return columnW / 30.4375;
            case ViewMode.Year: return columnW / 365.25;
            default: return columnW;
          }
        })();
        const anchorDateMs = new Date(ms[0].date + "T00:00:00").getTime();
        const xOf = (iso: string) =>
          anchorX + ((new Date(iso + "T00:00:00").getTime() - anchorDateMs) / 86400000) * ppd;

        // Lane group (background + diamants + noms) avec fingerprint :
        // on évite de wipe à chaque tick (ce qui détruirait le hover state)
        let lane = svg.querySelector("[data-milestone-lane]") as SVGGElement | null;
        if (!lane) {
          lane = document.createElementNS(ns, "g") as SVGGElement;
          lane.setAttribute("data-milestone-lane", "true");
          svg.appendChild(lane);
        }
        const fp =
          ms.map((m) => `${m.id}|${m.date}|${m.nom}|${(m.epic_trigrammes ?? []).join("+")}`).join(",") +
          `:${currentView}:${anchorX.toFixed(2)}:${rowMidY.toFixed(2)}:${rowHeight.toFixed(2)}:${bars.length}`;
        if (lane.getAttribute("data-fp") === fp && lane.children.length > 0) {
          // Aucun changement de jalons / vue / anchor → on ne touche à rien
          // (préserve le hover pill éventuellement présent)
          return;
        }
        lane.setAttribute("data-fp", fp);
        lane.innerHTML = "";

        // Background bandeau swimlane
        const svgW =
          parseFloat(svg.getAttribute("width") || "0") ||
          svg.getBoundingClientRect().width ||
          0;
        const bg = document.createElementNS(ns, "rect");
        bg.setAttribute("x", "0");
        bg.setAttribute("y", String(laneTop));
        bg.setAttribute("width", String(svgW));
        bg.setAttribute("height", String(rowHeight));
        bg.setAttribute("fill", "#fff3e0");
        bg.setAttribute("pointer-events", "none");
        lane.appendChild(bg);

        // Lignes verticales (groupe séparé pour z-order propre)
        let linesG = svg.querySelector("[data-milestone-lines]") as SVGGElement | null;
        if (!linesG) {
          linesG = document.createElementNS(ns, "g") as SVGGElement;
          linesG.setAttribute("data-milestone-lines", "true");
          svg.appendChild(linesG);
        }
        linesG.innerHTML = "";

        // Index des positions y de chaque barre ganttTask, par id
        const rowGeomById = new Map<string, { y: number; bottom: number }>();
        bars.forEach((bar, i) => {
          const id = ganttTasksRef.current[i]?.id;
          if (!id) return;
          const r = bar.querySelector("rect");
          if (!r) return;
          const ry = parseFloat(r.getAttribute("y") || "0");
          const rh = parseFloat(r.getAttribute("height") || "0");
          // Pour une milestone, le rect est centré dans la ligne (petit) ; pour project/task
          // le rect prend quasi toute la ligne. On élargit donc à la hauteur de ligne pour
          // ne pas tronquer la ligne au milieu d'une barre.
          const rowTop = id.startsWith("milestone-") ? ry + rh / 2 - rowHeight / 2 : ry;
          const rowBot = rowTop + rowHeight;
          rowGeomById.set(id, { y: rowTop, bottom: rowBot });
        });

        // Pour un jalon : liste des ids ganttTask concernés (projet + ses tâches dépliées,
        // OU tous les projets d'un epic + leurs tâches dépliées)
        const projectsByEpic = new Map<string, Project[]>();
        for (const p of projectsListRef.current) {
          if (!projectsByEpic.has(p.epic_trigramme))
            projectsByEpic.set(p.epic_trigramme, []);
          projectsByEpic.get(p.epic_trigramme)!.push(p);
        }
        const tasksByProj = new Map<number, Task[]>();
        for (const t of tasksListRef.current) {
          if (!tasksByProj.has(t.projet_id)) tasksByProj.set(t.projet_id, []);
          tasksByProj.get(t.projet_id)!.push(t);
        }
        function concernedIds(mil: Milestone): string[] {
          const out: string[] = [];
          const seen = new Set<string>();
          for (const tri of mil.epic_trigrammes ?? []) {
            for (const p of projectsByEpic.get(tri) ?? []) {
              const pid = `proj-${p.id}`;
              if (!seen.has(pid)) {
                seen.add(pid);
                out.push(pid);
              }
              for (const t of tasksByProj.get(p.id) ?? []) {
                const tid = `task-${t.id}`;
                if (!seen.has(tid)) {
                  seen.add(tid);
                  out.push(tid);
                }
              }
            }
          }
          return out;
        }

        // Diamants + noms avec collision detection (ordre x croissant)
        let lastNameRight = -Infinity;
        for (const m of ms) {
          const mx = xOf(m.date);

          // Diamant (rect rotated 45°) — cliquable pour ouvrir le panel
          const ds = 12;
          const diamond = document.createElementNS(ns, "rect");
          diamond.setAttribute("x", String(mx - ds / 2));
          diamond.setAttribute("y", String(rowMidY - ds / 2));
          diamond.setAttribute("width", String(ds));
          diamond.setAttribute("height", String(ds));
          diamond.setAttribute("fill", "#f57c00");
          diamond.setAttribute("transform", `rotate(45 ${mx} ${rowMidY})`);
          diamond.style.cursor = "pointer";
          const openMs = () => setPanelTarget({ type: "milestone", id: m.id });
          diamond.addEventListener("click", openMs);
          lane.appendChild(diamond);

          // Nom à droite du diamant (cliquable → ouvre le panel d'édition)
          const text = document.createElementNS(ns, "text");
          text.setAttribute("x", String(mx + 10));
          text.setAttribute("y", String(rowMidY));
          text.setAttribute("dominant-baseline", "central");
          text.setAttribute("font-family", "Roboto, sans-serif");
          text.setAttribute("font-size", "12");
          text.setAttribute("font-weight", "500");
          text.setAttribute("fill", "#e65100");
          text.style.cursor = "pointer";
          text.setAttribute("data-milestone-id", String(m.id));
          text.textContent = m.nom;
          text.addEventListener("click", openMs);
          let bgPill: SVGRectElement | null = null;
          text.addEventListener("mouseenter", () => {
            const bb = text.getBBox();
            bgPill = document.createElementNS(ns, "rect") as SVGRectElement;
            bgPill.setAttribute("x", String(bb.x - 5));
            bgPill.setAttribute("y", String(bb.y - 2));
            bgPill.setAttribute("width", String(bb.width + 10));
            bgPill.setAttribute("height", String(bb.height + 4));
            bgPill.setAttribute("rx", "3");
            bgPill.setAttribute("fill", "#f57c00");
            bgPill.setAttribute("pointer-events", "none");
            text.parentNode?.insertBefore(bgPill, text);
            text.setAttribute("fill", "white");
          });
          text.addEventListener("mouseleave", () => {
            bgPill?.remove();
            bgPill = null;
            text.setAttribute("fill", "#e65100");
          });
          lane.appendChild(text);

          // Collision : si le nom chevauche le précédent, on le masque (mais on garde le diamant)
          let bb: DOMRect | { x: number; width: number } = { x: mx + 10, width: 0 };
          try { bb = text.getBBox(); } catch { /* offscreen */ }
          if (bb.x < lastNameRight) {
            (text as SVGTextElement).style.display = "none";
          } else {
            lastNameRight = bb.x + bb.width + 8;
          }

          // Périmètre : on tronque la ligne aux barres concernées
          const laneBottom = laneTop + rowHeight;
          const concerned = concernedIds(m)
            .map((id) => rowGeomById.get(id))
            .filter((g): g is { y: number; bottom: number } => !!g);
          let mainY1: number, mainY2: number;
          let leaderActive = false;
          if (concerned.length > 0) {
            mainY1 = Math.min(...concerned.map((g) => g.y));
            mainY2 = Math.max(...concerned.map((g) => g.bottom));
            leaderActive = mainY1 > laneBottom + 1;
          } else {
            // Jalon orphelin (rattachement inexistant ou projet/tâches non chargées)
            mainY1 = laneBottom;
            mainY2 = svgH;
          }

          // Leader : segment estompé entre la swimlane et la zone concernée
          if (leaderActive) {
            const leader = document.createElementNS(ns, "line");
            leader.setAttribute("x1", String(mx));
            leader.setAttribute("x2", String(mx));
            leader.setAttribute("y1", String(laneBottom));
            leader.setAttribute("y2", String(mainY1));
            leader.setAttribute("stroke", "#f57c00");
            leader.setAttribute("stroke-width", "1");
            leader.setAttribute("stroke-dasharray", "2 4");
            leader.setAttribute("opacity", "0.25");
            leader.setAttribute("pointer-events", "none");
            linesG.appendChild(leader);
          }

          // Ligne principale visible (zone concernée)
          const line = document.createElementNS(ns, "line");
          line.setAttribute("x1", String(mx));
          line.setAttribute("x2", String(mx));
          line.setAttribute("y1", String(mainY1));
          line.setAttribute("y2", String(mainY2));
          line.setAttribute("stroke", "#f57c00");
          line.setAttribute("stroke-width", "1.5");
          line.setAttribute("stroke-dasharray", "5 4");
          line.setAttribute("opacity", "0.55");
          line.setAttribute("pointer-events", "none");
          linesG.appendChild(line);

          // Hit area large (transparent) sur toute la portée pour tooltip + hover
          const hit = document.createElementNS(ns, "line");
          hit.setAttribute("x1", String(mx));
          hit.setAttribute("x2", String(mx));
          hit.setAttribute("y1", String(laneBottom));
          hit.setAttribute("y2", String(mainY2));
          hit.setAttribute("stroke", "transparent");
          hit.setAttribute("stroke-width", "12");
          hit.setAttribute("pointer-events", "stroke");
          hit.style.cursor = "help";
          const tooltipText = `${m.nom} — ${fmtDate(toDate(m.date))}`;
          const showTooltip = (ev: MouseEvent) => {
            const tt = milestoneTooltipRef.current;
            if (!tt) return;
            tt.textContent = tooltipText;
            tt.style.display = "block";
            tt.style.left = `${ev.clientX + 12}px`;
            tt.style.top = `${ev.clientY + 12}px`;
          };
          const hideTooltip = () => {
            const tt = milestoneTooltipRef.current;
            if (tt) tt.style.display = "none";
          };
          hit.addEventListener("mouseenter", showTooltip as EventListener);
          hit.addEventListener("mousemove", showTooltip as EventListener);
          hit.addEventListener("mouseleave", hideTooltip);
          linesG.appendChild(hit);
        }
      }
    }

    const interval = setInterval(update, 300);
    const raf = requestAnimationFrame(update);
    return () => {
      clearInterval(interval);
      cancelAnimationFrame(raf);
    };
  }, []);

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
          if (t.id === "milestone-anchor") {
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
                  background: "#fff3e0",
                  color: "#e65100",
                  fontSize: 13,
                  fontWeight: 600,
                  letterSpacing: "0.4px",
                  gap: 6,
                }}
                title={`${allMilestones.length} jalon${allMilestones.length > 1 ? "s" : ""}`}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                  flag
                </span>
                Jalons
              </div>
            );
          }
          if (t.id.startsWith("task-")) {
            const taskId = Number(t.id.slice(5));
            const tinfo = taskInfoById.get(taskId);
            // Coche verte + barré si statut = archive (« fini »)
            const isDone = tinfo?.statut === "archive";
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
                <button
                  type="button"
                  onClick={() => setPanelTarget({ type: "task", id: taskId })}
                  title="Éditer la tâche"
                  style={{
                    background: "transparent",
                    border: 0,
                    padding: 0,
                    cursor: "pointer",
                    flex: 1,
                    textAlign: "left",
                    color: "inherit",
                    fontFamily: "inherit",
                    fontSize: "inherit",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    textDecoration: isDone ? "line-through" : "none",
                  }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "#1976d2")}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "#5f6368")}
                >
                  {t.name}
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
              <button
                type="button"
                onClick={tasksCount > 0 ? () => toggleProject(projId) : undefined}
                disabled={tasksCount === 0}
                title={
                  tasksCount > 0
                    ? isExpanded
                      ? "Replier les tâches"
                      : `Voir ${tasksCount} tâche${tasksCount > 1 ? "s" : ""}`
                    : "Pas de tâches"
                }
                style={{
                  background: "transparent",
                  border: 0,
                  padding: 0,
                  cursor: tasksCount > 0 ? "pointer" : "default",
                  flex: 1,
                  textAlign: "left",
                  color: "inherit",
                  fontFamily: "inherit",
                  fontSize: "inherit",
                  fontWeight: "inherit",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  textDecoration: isProjectDone ? "line-through" : "none",
                }}
              >
                {t.name}
              </button>
              <IconButton
                icon="add"
                title="Ajouter une tâche à ce projet"
                onClick={() => setPanelTarget({ type: "task-new", projet_id: projId })}
              />
              <IconButton
                icon="edit"
                title="Éditer le projet"
                onClick={() => setPanelTarget({ type: "project", id: projId })}
              />
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
            ? linkSource
              ? "Relâchez sur la tâche aval pour lier. Échap pour annuler."
              : "Glissez les barres · 🔗 pour lier · cliquez sur une flèche pour la supprimer."
            : "Clic sur un projet = déplier. ✏️ = panneau d'édition. Clic sur une tâche = panneau."}
        </span>
      </div>
      {ganttTasks.length === 0 ? (
        <p>Aucun projet planifié.</p>
      ) : (
        <div
          ref={ganttRef}
          className={`gantt-container ${editMode ? "edit-mode" : ""}`}
        >
          <Gantt
            tasks={ganttTasks}
            viewMode={view}
            locale="fr-FR"
            listCellWidth="380px"
            columnWidth={COLUMN_WIDTH_BY_VIEW[view] ?? 100}
            barFill={editMode ? 80 : 60}
            todayColor="rgba(255, 152, 0, 0.18)"
            arrowColor="#1976d2"
            arrowIndent={20}
            TaskListHeader={TaskListHeader}
            TaskListTable={CustomTaskListTable}
            TooltipContent={TooltipContent}
            onDateChange={handleDateChange}
          />
        </div>
      )}

      {/* FAB unique pour basculer le mode édition (drag + lier) */}
      <div className="fab-stack">
        <button
          type="button"
          className={`fab ${editMode ? "active" : ""}`}
          onClick={() => setEditMode((v) => !v)}
          title={editMode ? "Quitter l'édition" : "Mode édition"}
        >
          <span className="material-symbols-outlined">
            {editMode ? "lock_open" : "lock"}
          </span>
        </button>
      </div>

      {/* Handles de lien : icône link seule (sans rond) sur la droite
          de chaque barre de tâche, visible en mode édition. */}
      {editMode &&
        linkHandles.map((h) => (
          <button
            key={h.taskId}
            type="button"
            onMouseDown={(e) => startLinkDrag(h.taskId, e)}
            title="Glisser vers une autre tâche pour créer une dépendance"
            style={{
              position: "fixed",
              left: h.x - 9,
              top: h.y - 9,
              width: 18,
              height: 18,
              background: "transparent",
              border: 0,
              color: "white",
              padding: 0,
              cursor: "crosshair",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 50,
              filter: "drop-shadow(0 0 2px rgba(0,0,0,0.7))",
            }}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: 18, fontWeight: 700 }}
            >
              link
            </span>
          </button>
        ))}

      {/* Feedback drop-target pendant le drag */}
      {linkSource && hoveredTargetRect && (
        <div
          style={{
            position: "fixed",
            left: hoveredTargetRect.x - 3,
            top: hoveredTargetRect.y - 3,
            width: hoveredTargetRect.w + 6,
            height: hoveredTargetRect.h + 6,
            border: "2px solid #2e7d32",
            borderRadius: 6,
            boxShadow: "0 0 0 4px rgba(46, 125, 50, 0.25)",
            background: "rgba(46, 125, 50, 0.08)",
            pointerEvents: "none",
            zIndex: 80,
            transition: "left 80ms, top 80ms, width 80ms, height 80ms",
          }}
        />
      )}

      {/* Overlay : flèche de la barre source vers le curseur */}
      {linkSource && sourcePos && cursorPos && (
        <svg
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            pointerEvents: "none",
            zIndex: 90,
          }}
        >
          <defs>
            <marker
              id="link-arrow-head"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#1976d2" />
            </marker>
          </defs>
          <line
            x1={sourcePos.x}
            y1={sourcePos.y}
            x2={cursorPos.x}
            y2={cursorPos.y}
            stroke="#1976d2"
            strokeWidth={2.5}
            strokeDasharray="6 4"
            markerEnd="url(#link-arrow-head)"
          />
        </svg>
      )}

      {/* Overlay calendrier figé en haut quand l'original est au-dessus du viewport */}
      <div
        ref={stickyOverlayRef}
        style={{
          position: "fixed",
          top: 0,
          height: 50,
          zIndex: 30,
          pointerEvents: "none",
          display: "none",
          overflow: "hidden",
        }}
      />
      {/* Tooltip qui suit le curseur au survol des lignes verticales de jalons */}
      <div
        ref={milestoneTooltipRef}
        style={{
          position: "fixed",
          display: "none",
          pointerEvents: "none",
          zIndex: 100,
          background: "#1f2329",
          color: "white",
          padding: "5px 9px",
          borderRadius: 4,
          fontSize: 12,
          fontFamily: "Roboto, sans-serif",
          fontWeight: 500,
          boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
          whiteSpace: "nowrap",
        }}
      />
      <EditPanel target={panelTarget} onClose={() => setPanelTarget(null)} onSaved={load} />
    </>
  );
}
