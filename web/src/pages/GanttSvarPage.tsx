// C9 Phase 2b — Nouveau planning bâti sur SVAR, construit EN PARALLÈLE de l'actuel
// (route non listée /planning-svar). Réutilise usePlanningData (Phase 1) et les
// mappings purs buildSvarTasks/buildSvarLinks. Incrément 1 : rendu lecture seule
// (hiérarchie + jalons + dépendances). Drag/persist, contrôles, décorations,
// undo, panneau : incréments suivants.
import { useMemo, useRef, useState } from "react";
import { Gantt, Willow } from "@svar-ui/react-gantt";
import type { IApi, TID, ILink } from "@svar-ui/react-gantt";
import "@svar-ui/react-gantt/all.css";
import "./gantt-svar.css"; // correctifs thème (icône corbeille cliquable — cf. fichier)
import { usePlanningData } from "../planning/usePlanningData";
import { buildSvarTasks } from "../planning/buildSvarTasks";
import { buildSvarLinks, svarLinkToDependency } from "../planning/buildSvarLinks";
import { parseSvarId } from "../planning/svarAdapter";
import { isoDate, toDate, daysBetweenIso, fmtDate } from "../planning/dates";
import { planCascadeShifts, planGroupShifts, type FsEdge, type TaskDates } from "../planning/cascadeShifts";
import {
  tasks as tasksApi,
  projects as projectsApi,
  milestones as milestonesApi,
  dependencies as depsApi,
} from "../api/endpoints";
import { ErrorBanner } from "../components/ErrorBanner";
import type { Task } from "../types";

type Scale = { unit: "year" | "month" | "week" | "day"; step: number; format: (d: Date) => string };
type ZoomLevel = "day" | "week" | "month";

const MONTH_TOP: Scale = {
  unit: "month",
  step: 1,
  format: (d) => d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" }),
};

// Niveaux de zoom Jour / Semaine / Mois : échelles + largeur de cellule.
const ZOOMS: Record<ZoomLevel, { label: string; cellWidth: number; scales: Scale[] }> = {
  day: {
    label: "Jour",
    cellWidth: 36,
    scales: [MONTH_TOP, { unit: "day", step: 1, format: (d) => String(d.getDate()) }],
  },
  week: {
    label: "Semaine",
    cellWidth: 52,
    scales: [MONTH_TOP, { unit: "week", step: 1, format: (d) => d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }) }],
  },
  month: {
    label: "Mois",
    cellWidth: 90,
    scales: [
      { unit: "year", step: 1, format: (d) => String(d.getFullYear()) },
      { unit: "month", step: 1, format: (d) => d.toLocaleDateString("fr-FR", { month: "short" }) },
    ],
  },
};
const ZOOM_ORDER: ZoomLevel[] = ["day", "week", "month"];

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// Graphe FS et dates courantes lus depuis le STORE SVAR (source de vérité après des
// drags successifs — l'état React de usePlanningData n'est pas rechargé côté SVAR).
function fsEdgesFromStore(api: IApi): FsEdge[] {
  const edges: FsEdge[] = [];
  api.getState().links.forEach((l) => {
    if (l.type !== "e2s") return; // FS seulement (cf. buildSvarLinks)
    const s = parseSvarId(String(l.source));
    const t = parseSvarId(String(l.target));
    if (s?.kind === "task" && t?.kind === "task") {
      edges.push({ amontId: Number(s.ref), avalId: Number(t.ref) });
    }
  });
  return edges;
}

function taskDatesForIds(api: IApi, ids: Iterable<number>): Map<number, TaskDates> {
  const m = new Map<number, TaskDates>();
  for (const id of ids) {
    const st = api.getTask(`task:${id}`);
    if (st?.start && st?.end) m.set(id, { date_debut: isoDate(st.start), date_fin: isoDate(st.end) });
  }
  return m;
}

function taskDatesFromStore(api: IApi, edges: FsEdge[]): Map<number, TaskDates> {
  const ids = new Set<number>();
  for (const e of edges) {
    ids.add(e.amontId);
    ids.add(e.avalId);
  }
  return taskDatesForIds(api, ids);
}

// Ids des tâches actuellement sélectionnées (multi-sélection SVAR : Ctrl/⌘+clic).
function selectedTaskIds(api: IApi): number[] {
  const ids: number[] = [];
  for (const sid of api.getState().selected ?? []) {
    const p = parseSvarId(String(sid));
    if (p?.kind === "task") ids.push(Number(p.ref));
  }
  return ids;
}

export default function GanttSvarPage() {
  const [err, setErr] = useState<unknown>(null);
  const [zoom, setZoom] = useState<ZoomLevel>("day");
  const apiRef = useRef<IApi | null>(null);
  const { epics, projects, tasks, dependencies, milestones } = usePlanningData({
    onError: setErr,
  });

  // Colonne « aujourd'hui » surlignée (parité todayColor de l'ancien Gantt).
  const todayIso = useMemo(() => isoDate(startOfToday()), []);
  const highlightToday = useMemo(() => (d: Date) => (isoDate(d) === todayIso ? "wx-today-col" : ""), [todayIso]);

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

  // Rollback (SPEC §4) : dates d'origine capturées AVANT l'application du drag.
  const originalRef = useRef<Map<TID, { start: Date; end: Date }>>(new Map());
  // Lien capturé AVANT suppression, pour pouvoir le rétablir si l'API refuse.
  const deletedLinkRef = useRef<Map<TID, Pick<ILink, "source" | "target" | "type">>>(new Map());

  const onInit = (api: IApi) => {
    apiRef.current = api;
    api.intercept("update-task", (ev) => {
      // Ne capturer l'origine que pour un vrai geste utilisateur (pas nos ré-émissions).
      if (ev.eventSource === "rollback" || ev.eventSource === "cascade") return true;
      if (!originalRef.current.has(ev.id)) {
        const t = api.getTask(ev.id);
        if (t?.start && t?.end) originalRef.current.set(ev.id, { start: t.start, end: t.end });
      }
      return true;
    });

    // Applique une liste de décalages (cascade OU groupe) : visuel immédiat (exec
    // eventSource "cascade" pour ne pas re-déclencher le handler), puis persistance
    // groupée ; rollback visuel de la tâche déplacée ET des décalées si l'API refuse.
    const applyShiftsAndPersist = async (
      movedId: number,
      moved: { date_debut: string; date_fin: string },
      shifts: { id: number; date_debut: string; date_fin: string }[],
      orig: { start: Date; end: Date } | undefined,
      movedTid: TID,
    ) => {
      const applied: { id: number; start: Date; end: Date }[] = [];
      for (const s of shifts) {
        const st = api.getTask(`task:${s.id}`);
        if (!st?.start || !st?.end) continue;
        applied.push({ id: s.id, start: st.start, end: st.end });
        api.exec("update-task", {
          id: `task:${s.id}`,
          task: { start: toDate(s.date_debut), end: toDate(s.date_fin) },
          skipUndo: true,
          eventSource: "cascade",
        });
      }
      try {
        await Promise.all([
          tasksApi.update(movedId, moved),
          ...shifts.map((s) => tasksApi.update(s.id, { date_debut: s.date_debut, date_fin: s.date_fin })),
        ]);
      } catch (e) {
        setErr(e);
        if (orig) {
          api.exec("update-task", { id: movedTid, task: { start: orig.start, end: orig.end }, skipUndo: true, eventSource: "rollback" });
        }
        for (const a of applied) {
          api.exec("update-task", { id: `task:${a.id}`, task: { start: a.start, end: a.end }, skipUndo: true, eventSource: "rollback" });
        }
      }
    };

    // Au commit du drag (inProgress=false) : persister ; sur refus API, rollback.
    // eventSource "cascade" = nos décalages (cascade/groupe) ré-émis → ne pas re-traiter.
    api.on("update-task", async (ev) => {
      if (ev.eventSource === "rollback" || ev.eventSource === "cascade" || ev.inProgress) return;
      const orig = originalRef.current.get(ev.id);
      originalRef.current.delete(ev.id);
      const parsed = parseSvarId(String(ev.id));
      const t = api.getTask(ev.id);
      if (!parsed || !t?.start) return;
      const date_debut = isoDate(t.start);
      const date_fin = t.end ? isoDate(t.end) : date_debut;
      setErr(null);

      // Tâche : décalage de GROUPE si multi-sélection, sinon cascade FS.
      if (parsed.kind === "task") {
        const movedId = Number(parsed.ref);
        const moved = { date_debut, date_fin };
        const selected = selectedTaskIds(api);

        if (selected.length > 1 && selected.includes(movedId)) {
          // Groupe : les sélectionnées suivent le delta du DÉBUT ; pas de cascade.
          const deltaDays = orig ? daysBetweenIso(isoDate(orig.start), date_debut) : 0;
          const shifts = planGroupShifts({
            movedId,
            deltaDays,
            selectedIds: selected,
            taskDates: taskDatesForIds(api, selected),
          });
          await applyShiftsAndPersist(movedId, moved, shifts, orig, ev.id);
          return;
        }

        // Cascade FS : delta de la FIN propagé aux tâches postérieures.
        const deltaDays = orig && t.end ? daysBetweenIso(isoDate(orig.end), date_fin) : 0;
        const edges = fsEdgesFromStore(api);
        const shifts = planCascadeShifts({
          movedId,
          oldStartIso: orig ? isoDate(orig.start) : date_debut,
          deltaDays,
          edges,
          taskDates: taskDatesFromStore(api, edges),
        });
        await applyShiftsAndPersist(movedId, moved, shifts, orig, ev.id);
        return;
      }

      // Projet / jalon : persistance simple (pas de cascade).
      try {
        if (parsed.kind === "proj") await projectsApi.update(Number(parsed.ref), { date_debut, date_fin });
        else if (parsed.kind === "ms") await milestonesApi.update(Number(parsed.ref), { date: date_debut });
        else return; // epic (summary) : pas de persistance
      } catch (e) {
        setErr(e);
        if (orig) {
          api.exec("update-task", {
            id: ev.id,
            task: { start: orig.start, end: orig.end },
            skipUndo: true,
            eventSource: "rollback",
          });
        }
      }
    });

    // — Liens (dépendances) —
    // Avant suppression : mémoriser le lien pour pouvoir le rétablir (rollback).
    api.intercept("delete-link", (ev) => {
      const link = api.getState().links.byId(ev.id);
      if (link) {
        deletedLinkRef.current.set(ev.id, { source: link.source, target: link.target, type: link.type });
      }
      return true;
    });

    // Dessin d'un lien : créer la dépendance. Au succès, réaffecter l'id temporaire
    // à l'id réel (pour une suppression ultérieure). Au refus — ou si le lien n'est
    // pas représentable (extrémité non-tâche, type SF) — retirer le lien.
    api.on("add-link", async (ev) => {
      if (ev.eventSource === "rollback") return; // notre propre rétablissement
      const id = ev.id;
      if (id == null) return;
      const draft = svarLinkToDependency(ev.link);
      if (!draft) {
        api.exec("delete-link", { id });
        setErr(new Error("Lien non pris en charge : une dépendance relie deux tâches (FS, SS ou FF)."));
        return;
      }
      setErr(null);
      try {
        const created = await depsApi.create(draft);
        if (created?.id != null) {
          api.exec("update-link", { id, link: { id: created.id } });
        }
      } catch (e) {
        setErr(e);
        api.exec("delete-link", { id }); // rollback : retirer le lien non persisté
      }
    });

    // Suppression d'un lien : ne persister que les liens réels (id numérique) ; un id
    // temporaire = lien jamais enregistré (création annulée/refusée). Rollback en
    // rétablissant le lien capturé si l'API refuse.
    api.on("delete-link", async (ev) => {
      const captured = deletedLinkRef.current.get(ev.id);
      deletedLinkRef.current.delete(ev.id);
      if (typeof ev.id !== "number") return; // lien non persisté : rien à faire
      setErr(null);
      try {
        await depsApi.remove(ev.id);
      } catch (e) {
        setErr(e);
        if (captured) {
          api.exec("add-link", { link: { id: ev.id, ...captured }, eventSource: "rollback" });
        }
      }
    });
  };

  return (
    <>
      <h2>Planning (SVAR) — aperçu Phase 2b</h2>
      <div className="svar-controls">
        <div className="svar-zoom" role="group" aria-label="Zoom">
          {ZOOM_ORDER.map((z) => (
            <button
              key={z}
              type="button"
              className={zoom === z ? "active" : ""}
              aria-pressed={zoom === z}
              onClick={() => setZoom(z)}
            >
              {ZOOMS[z].label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="svar-today"
          onClick={() => apiRef.current?.exec("scroll-chart", { date: startOfToday() })}
          title="Recentrer sur aujourd'hui"
        >
          <span className="material-symbols-outlined" aria-hidden="true">today</span>
          Aujourd'hui : {fmtDate(new Date())}
        </button>
      </div>
      <ErrorBanner error={err} />
      <div style={{ height: "78vh", border: "1px solid #e5e7eb" }}>
        <Willow>
          <Gantt
            tasks={svarTasks}
            links={svarLinks}
            scales={ZOOMS[zoom].scales}
            cellWidth={ZOOMS[zoom].cellWidth}
            highlightTime={highlightToday}
            init={onInit}
          />
        </Willow>
      </div>
    </>
  );
}
