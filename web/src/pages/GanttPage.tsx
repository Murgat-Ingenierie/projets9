import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Gantt, Task as GanttTask, ViewMode } from "gantt-task-react";
import "gantt-task-react/dist/index.css";
import { dependencies as depsApi, epics, projects, tasks } from "../api/endpoints";
import { EditPanel, type PanelTarget } from "../components/EditPanel";
import { ErrorBanner } from "../components/ErrorBanner";
import { navState } from "../hooks/useBreadcrumbState";
import type { Dependency, Epic, Project, Task } from "../types";

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
  const [editMode, setEditMode] = useState(false);
  const [expandedProjects, setExpandedProjects] = useState<Set<number>>(new Set());
  const [panelTarget, setPanelTarget] = useState<PanelTarget | null>(null);
  const [allDeps, setAllDeps] = useState<Dependency[]>([]);

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
    Promise.all([epics.list(), projects.list(), tasks.list(), depsApi.list()])
      .then(([e, p, t, d]) => {
        setEpics(e);
        setProjects(p);
        setTasks(t);
        setAllDeps(d);
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
  }, [epicsList, projectsList, tasksByProject, expandedProjects, editMode, depsByAval]);
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
    const m = new Map<number, { statut: string; avancement: number }>();
    for (const t of tasksList) m.set(t.id, { statut: t.statut, avancement: t.avancement });
    return m;
  }, [tasksList]);

  // Tableau parallèle à ganttTasks indiquant si chaque ligne est "finie".
  // Tâche : statut = archive OU avancement = 100. Projet : statut = realise.
  const doneByIndex = useMemo(() => {
    return ganttTasks.map((t) => {
      if (t.id.startsWith("task-")) {
        const info = taskInfoById.get(Number(t.id.slice(5)));
        return info?.statut === "archive" || info?.avancement === 100;
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

  // Mise en valeur des items finis (option C) :
  //  - fond de la barre à 40 % d'opacité (aplatissement visuel)
  //  - contour vert success 2 px
  //  - gros ✓ blanc au début de la barre
  useEffect(() => {
    const GREEN = "#2e7d32";
    function update() {
      const root = ganttRef.current;
      if (!root) return;
      const svg = root.querySelector("svg");
      if (!svg) return;
      const ns = "http://www.w3.org/2000/svg";

      const MIN_W = 28; // seuil purement esthétique pour le stroke vert
      const bars = root.querySelectorAll("svg g[tabindex]");
      bars.forEach((bar, i) => {
        const isDone = doneByIndexRef.current[i];
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
          if (t.id.startsWith("task-")) {
            const taskId = Number(t.id.slice(5));
            const tinfo = taskInfoById.get(taskId);
            // Coche verte + barré si archivée OU à 100 % d'avancement
            const isDone = tinfo?.statut === "archive" || tinfo?.avancement === 100;
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
              <button
                type="button"
                onClick={() =>
                  nav(
                    `/projects/${projId}/edit`,
                    navState([], { label: "Planning", to: "/" })
                  )
                }
                title="Ouvrir la page complète du projet"
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
                  flexShrink: 0,
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
      <EditPanel target={panelTarget} onClose={() => setPanelTarget(null)} onSaved={load} />
    </>
  );
}
