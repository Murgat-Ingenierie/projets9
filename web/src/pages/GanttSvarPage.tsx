// C9 Phase 2b — Nouveau planning bâti sur SVAR, construit EN PARALLÈLE de l'actuel
// (route non listée /planning-svar). Réutilise usePlanningData (Phase 1) et les
// mappings purs buildSvarTasks/buildSvarLinks. Incrément 1 : rendu lecture seule
// (hiérarchie + jalons + dépendances). Drag/persist, contrôles, décorations,
// undo, panneau : incréments suivants.
import { useMemo, useRef, useState } from "react";
import { Gantt, Willow } from "@svar-ui/react-gantt";
import type { IApi, TID } from "@svar-ui/react-gantt";
import "@svar-ui/react-gantt/all.css";
import { usePlanningData } from "../planning/usePlanningData";
import { buildSvarTasks } from "../planning/buildSvarTasks";
import { buildSvarLinks } from "../planning/buildSvarLinks";
import { parseSvarId } from "../planning/svarAdapter";
import { isoDate } from "../planning/dates";
import { tasks as tasksApi, projects as projectsApi, milestones as milestonesApi } from "../api/endpoints";
import { ErrorBanner } from "../components/ErrorBanner";
import type { Task } from "../types";

const SCALES = [
  { unit: "month", step: 1, format: (d: Date) => d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" }) },
  { unit: "day", step: 1, format: (d: Date) => String(d.getDate()) },
];

export default function GanttSvarPage() {
  const [err, setErr] = useState<unknown>(null);
  const { epics, projects, tasks, dependencies, milestones } = usePlanningData({
    onError: setErr,
  });

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

  const onInit = (api: IApi) => {
    api.intercept("update-task", (ev) => {
      if (ev.eventSource === "rollback") return true;
      if (!originalRef.current.has(ev.id)) {
        const t = api.getTask(ev.id);
        if (t?.start && t?.end) originalRef.current.set(ev.id, { start: t.start, end: t.end });
      }
      return true;
    });

    // Au commit du drag (inProgress=false) : persister ; sur refus API (409), rollback.
    api.on("update-task", async (ev) => {
      if (ev.eventSource === "rollback" || ev.inProgress) return;
      const orig = originalRef.current.get(ev.id);
      originalRef.current.delete(ev.id);
      const parsed = parseSvarId(String(ev.id));
      const t = api.getTask(ev.id);
      if (!parsed || !t?.start) return;
      const date_debut = isoDate(t.start);
      const date_fin = t.end ? isoDate(t.end) : date_debut;
      setErr(null);
      try {
        if (parsed.kind === "task") await tasksApi.update(Number(parsed.ref), { date_debut, date_fin });
        else if (parsed.kind === "proj") await projectsApi.update(Number(parsed.ref), { date_debut, date_fin });
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
  };

  return (
    <>
      <h2>Planning (SVAR) — aperçu Phase 2b</h2>
      <ErrorBanner error={err} />
      <div style={{ height: "82vh", border: "1px solid #e5e7eb" }}>
        <Willow>
          <Gantt tasks={svarTasks} links={svarLinks} scales={SCALES} cellWidth={36} init={onInit} />
        </Willow>
      </div>
    </>
  );
}
