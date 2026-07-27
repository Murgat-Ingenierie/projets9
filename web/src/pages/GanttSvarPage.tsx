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
import { isoDate } from "../planning/dates";
import {
  tasks as tasksApi,
  projects as projectsApi,
  milestones as milestonesApi,
  dependencies as depsApi,
} from "../api/endpoints";
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
  // Lien capturé AVANT suppression, pour pouvoir le rétablir si l'API refuse.
  const deletedLinkRef = useRef<Map<TID, Pick<ILink, "source" | "target" | "type">>>(new Map());

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
      <ErrorBanner error={err} />
      <div style={{ height: "82vh", border: "1px solid #e5e7eb" }}>
        <Willow>
          <Gantt tasks={svarTasks} links={svarLinks} scales={SCALES} cellWidth={36} init={onInit} />
        </Willow>
      </div>
    </>
  );
}
