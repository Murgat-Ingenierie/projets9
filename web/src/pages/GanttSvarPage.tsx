// C9 Phase 2b — Nouveau planning bâti sur SVAR, construit EN PARALLÈLE de l'actuel
// (route non listée /planning-svar). Réutilise usePlanningData (Phase 1) et les
// mappings purs buildSvarTasks/buildSvarLinks. Incrément 1 : rendu lecture seule
// (hiérarchie + jalons + dépendances). Drag/persist, contrôles, décorations,
// undo, panneau : incréments suivants.
import { useEffect, useMemo, useRef, useState } from "react";
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
import { deriveTeamFilter } from "../planning/teamFilter";
import {
  tasks as tasksApi,
  projects as projectsApi,
  milestones as milestonesApi,
  dependencies as depsApi,
} from "../api/endpoints";
import { ErrorBanner } from "../components/ErrorBanner";
import type { Dependency, Task } from "../types";

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
  // Colonnes hebdomadaires via un pas de 7 JOURS (unité mini = jour) : les cellules
  // de mois gardent une largeur exacte (proportionnelle aux jours), au lieu d'être
  // arrondies au nombre entier de semaines — ce qui décalait l'entête des mois.
  week: {
    label: "Semaine",
    cellWidth: 8,
    scales: [MONTH_TOP, { unit: "day", step: 7, format: (d) => d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }) }],
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

// Graphe FS et dates depuis l'état React COMPLET (usePlanningData), PAS le store SVAR
// qui peut être filtré par équipe : la cascade doit propager même vers des tâches
// masquées (parité ancien Gantt). L'état React est frais (reload après chaque mutation).
function fsEdgesFromDeps(deps: Dependency[]): FsEdge[] {
  const edges: FsEdge[] = [];
  for (const d of deps) {
    if (d.type === "FS") edges.push({ amontId: d.tache_amont_id, avalId: d.tache_aval_id });
  }
  return edges;
}

function taskDatesFromTasks(tasks: Task[]): Map<number, TaskDates> {
  const m = new Map<number, TaskDates>();
  for (const t of tasks) m.set(t.id, { date_debut: t.date_debut, date_fin: t.date_fin });
  return m;
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
  // Défaut À PLAT (parité avec l'ancien Gantt) : projets au niveau racine ; le toggle
  // « Grouper par epic » ajoute les lignes d'en-tête epic (reparente sous l'epic).
  const [groupByEpic, setGroupByEpic] = useState(false);
  const [selectedTeamIds, setSelectedTeamIds] = useState<Set<number>>(new Set());
  const apiRef = useRef<IApi | null>(null);
  // État déplié (id de ligne → ouvert), suivi HORS React (ref) : survit aux
  // reconstructions de l'arbre (filtre/groupe) sans re-render à chaque expand/repli.
  const openStateRef = useRef<Map<string, boolean>>(new Map());
  const { epics, projects, tasks, dependencies, milestones, equipes, allocations, reload } = usePlanningData({
    onError: setErr,
  });

  // Données React fraîches pour les handlers (closure onInit) : la cascade lit le
  // graphe COMPLET (toutes les tâches + dépendances), pas le store filtré → parité.
  const tasksRef = useRef(tasks);
  const depsRef = useRef(dependencies);
  useEffect(() => {
    tasksRef.current = tasks;
    depsRef.current = dependencies;
  });

  // Filtre équipe : tâches/projets en scope (null = pas de filtre). Pur, testé.
  const { taskIds: teamFilterTaskIds, projectIds: teamFilterProjectIds } = useMemo(
    () => deriveTeamFilter({ allocations, tasks, selectedTeamIds }),
    [allocations, tasks, selectedTeamIds],
  );

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

  // Réactivité : SVAR relit toute la prop `tasks` à chaque changement de référence.
  // On préserve l'état déplié via openStateRef, et reload() après chaque mutation
  // garde l'état React frais → un changement de filtre/groupe reconstruit l'arbre
  // depuis les dates PERSISTÉES (pas de retour à l'ancienne date).
  const svarTasks = useMemo(
    () =>
      buildSvarTasks({
        epics,
        projects,
        tasksByProject,
        milestones,
        teamFilterProjectIds,
        teamFilterTaskIds,
        groupByEpic,
        // Lu au recalcul du memo (dep filtre/groupe/données) ; SVAR a déjà appliqué
        // l'expand impérativement entre-temps, donc une valeur « périmée » est sans effet.
        // eslint-disable-next-line react-hooks/refs
        openState: openStateRef.current,
      }),
    [epics, projects, tasksByProject, milestones, teamFilterProjectIds, teamFilterTaskIds, groupByEpic],
  );

  // Liens filtrés au périmètre équipe : on ne garde que les dépendances dont les DEUX
  // extrémités sont visibles (évite les liens pendants et une cascade vers des tâches
  // hors scope — l'édition sous filtre ne propage pas au-delà du périmètre).
  const svarLinks = useMemo(() => {
    const all = buildSvarLinks(dependencies);
    if (!teamFilterTaskIds) return all;
    return all.filter((l) => {
      const s = parseSvarId(String(l.source));
      const t = parseSvarId(String(l.target));
      return (
        s?.kind === "task" &&
        t?.kind === "task" &&
        teamFilterTaskIds.has(Number(s.ref)) &&
        teamFilterTaskIds.has(Number(t.ref))
      );
    });
  }, [dependencies, teamFilterTaskIds]);

  // Rollback (SPEC §4) : dates d'origine capturées AVANT l'application du drag.
  const originalRef = useRef<Map<TID, { start: Date; end: Date }>>(new Map());
  // Lien capturé AVANT suppression, pour pouvoir le rétablir si l'API refuse.
  const deletedLinkRef = useRef<Map<TID, Pick<ILink, "source" | "target" | "type">>>(new Map());

  const onInit = (api: IApi) => {
    apiRef.current = api;

    // Mémoriser l'état déplié à chaque expand/repli (ref, pas de re-render) : préservé
    // lors des reconstructions de l'arbre (cf. openStateRef passé à buildSvarTasks).
    api.on("open-task", (ev) => {
      openStateRef.current.set(String(ev.id), Boolean(ev.mode));
    });

    api.intercept("update-task", (ev) => {
      // Ne capturer l'origine que pour un vrai geste utilisateur (pas nos ré-émissions).
      if (ev.eventSource === "rollback" || ev.eventSource === "cascade") return true;
      if (!originalRef.current.has(ev.id)) {
        const t = api.getTask(ev.id);
        if (t?.start && t?.end) originalRef.current.set(ev.id, { start: t.start, end: t.end });
      }
      return true;
    });

    // Applique une liste de décalages (cascade OU groupe) : visuel immédiat pour les
    // tâches VISIBLES (les masquées sont persistées sans exec puis rapatriées par
    // reload), puis persistance groupée et reload() — qui RÉCONCILIE succès ET échec
    // depuis la vérité serveur (comme l'ancien Gantt ; pas de rollback manuel).
    const applyShiftsAndPersist = async (
      movedId: number,
      moved: { date_debut: string; date_fin: string },
      shifts: { id: number; date_debut: string; date_fin: string }[],
    ) => {
      for (const s of shifts) {
        if (api.getTask(`task:${s.id}`)) {
          api.exec("update-task", {
            id: `task:${s.id}`,
            task: { start: toDate(s.date_debut), end: toDate(s.date_fin) },
            skipUndo: true,
            eventSource: "cascade",
          });
        }
      }
      try {
        await Promise.all([
          tasksApi.update(movedId, moved),
          ...shifts.map((s) => tasksApi.update(s.id, { date_debut: s.date_debut, date_fin: s.date_fin })),
        ]);
      } catch (e) {
        setErr(e);
      }
      reload();
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
            taskDates: taskDatesFromTasks(tasksRef.current),
          });
          await applyShiftsAndPersist(movedId, moved, shifts);
          return;
        }

        // Cascade FS sur le graphe COMPLET (dépendances + toutes les tâches, état React
        // frais) : propage même vers un successeur masqué par le filtre équipe.
        const deltaDays = orig && t.end ? daysBetweenIso(isoDate(orig.end), date_fin) : 0;
        const shifts = planCascadeShifts({
          movedId,
          oldStartIso: orig ? isoDate(orig.start) : date_debut,
          deltaDays,
          edges: fsEdgesFromDeps(depsRef.current),
          taskDates: taskDatesFromTasks(tasksRef.current),
        });
        await applyShiftsAndPersist(movedId, moved, shifts);
        return;
      }

      // Projet / jalon : persistance simple (pas de cascade).
      try {
        if (parsed.kind === "proj") await projectsApi.update(Number(parsed.ref), { date_debut, date_fin });
        else if (parsed.kind === "ms") await milestonesApi.update(Number(parsed.ref), { date: date_debut });
        else return; // epic (summary) : pas de persistance
        reload();
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
        reload();
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
        reload();
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
          className={`svar-toggle${groupByEpic ? " active" : ""}`}
          aria-pressed={groupByEpic}
          onClick={() => setGroupByEpic((v) => !v)}
          title="Afficher une ligne d'en-tête par epic"
        >
          <span className="material-symbols-outlined" aria-hidden="true">
            {groupByEpic ? "folder_open" : "folder"}
          </span>
          Grouper par epic
        </button>
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
      {equipes.length > 0 && (
        <div className="svar-teams">
          <span className="svar-teams-label">
            <span className="material-symbols-outlined" aria-hidden="true">groups</span>
            Filtrer par équipe :
          </span>
          {equipes.map((eq) => {
            const active = selectedTeamIds.has(eq.id);
            return (
              <button
                key={eq.id}
                type="button"
                className={`svar-chip${active ? " active" : ""}`}
                aria-pressed={active}
                title={`${eq.nom} · ${eq.temps_dispo_hebdo} h/sem`}
                onClick={() =>
                  setSelectedTeamIds((prev) => {
                    const next = new Set(prev);
                    if (next.has(eq.id)) next.delete(eq.id);
                    else next.add(eq.id);
                    return next;
                  })
                }
              >
                {eq.nom}
              </button>
            );
          })}
          {selectedTeamIds.size > 0 && (
            <button
              type="button"
              className="svar-chip-reset"
              title="Vider le filtre équipe"
              onClick={() => setSelectedTeamIds(new Set())}
            >
              <span className="material-symbols-outlined" aria-hidden="true">close</span>
              Réinitialiser
            </button>
          )}
        </div>
      )}
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
