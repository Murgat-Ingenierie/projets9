// PHASE 2a — Prototype du risque n°1 : drag → persister via l'API → ROLLBACK si
// l'API refuse (409 invariant, SPEC §4), sur SVAR. But : valider que
// api.on('update-task') + api.exec('update-task', …ancien) permet ce flux.
// NE PAS MERGER tel quel : route de prototype non listée.
import { useRef, useState } from "react";
import { Gantt, Willow } from "@svar-ui/react-gantt";
import type { IApi, ITask, ILink, TID } from "@svar-ui/react-gantt";
import "@svar-ui/react-gantt/all.css";
import { isoDate, toDate } from "../planning/dates";

const TASKS: ITask[] = [
  { id: 1, text: "Tâche A (API OK)", type: "task", start: toDate("2026-07-06"), end: toDate("2026-07-20") },
  { id: 2, text: "Tâche B (API 409)", type: "task", start: toDate("2026-07-22"), end: toDate("2026-08-05") },
];

const SCALES = [
  { unit: "month", step: 1, format: (x: Date) => x.toLocaleDateString("fr-FR", { month: "long", year: "numeric" }) },
  { unit: "day", step: 1, format: (x: Date) => String(x.getDate()) },
];

// Mock API : la tâche 2 est refusée (409) pour éprouver le rollback ; la 1 passe.
async function persistTask(id: TID, startIso: string, endIso: string): Promise<void> {
  await new Promise((r) => setTimeout(r, 120));
  if (Number(id) === 2) {
    throw { status: 409, code: "INV-8", message: `refus simulé (${startIso}→${endIso})` };
  }
}

// Mock : refuse toute création de lien (409) pour éprouver le rollback de lien.
async function persistLink(): Promise<void> {
  await new Promise((r) => setTimeout(r, 120));
  throw { status: 409, code: "INV-14", message: "lien refusé (simulé)" };
}

const LINKS: ILink[] = [];

export default function GanttSvarPrototype() {
  const [log, setLog] = useState<string[]>([]);
  const apiRef = useRef<IApi | null>(null);
  // Dates AVANT modification, capturées à l'interception (pour rollback).
  const originalRef = useRef<Map<TID, { start: Date; end: Date }>>(new Map());
  const addLog = (s: string) => setLog((l) => [...l.slice(-18), s]);

  const onInit = (api: IApi) => {
    apiRef.current = api;

    // AVANT l'application : mémoriser l'état d'origine (une fois par tâche).
    api.intercept("update-task", (ev) => {
      if (ev.eventSource === "rollback") return true;
      if (!originalRef.current.has(ev.id)) {
        const t = api.getTask(ev.id);
        originalRef.current.set(ev.id, { start: t.start!, end: t.end! });
      }
      return true;
    });

    // APRÈS l'application : persister, et rollback si l'API refuse.
    api.on("update-task", async (ev) => {
      if (ev.eventSource === "rollback") return;
      addLog(`update-task id=${ev.id} inProgress=${String(ev.inProgress ?? false)}`);
      if (ev.inProgress) return; // pendant le drag : on ne persiste pas
      const orig = originalRef.current.get(ev.id);
      originalRef.current.delete(ev.id);
      const t = api.getTask(ev.id);
      try {
        await persistTask(ev.id, isoDate(t.start!), isoDate(t.end!));
        addLog(`  ✓ persisté id=${ev.id} (${isoDate(t.start!)}→${isoDate(t.end!)})`);
      } catch (e) {
        const msg = (e as { message?: string })?.message ?? String(e);
        addLog(`  ✗ 409 id=${ev.id} → rollback (${msg})`);
        if (orig) {
          api.exec("update-task", {
            id: ev.id,
            task: { start: orig.start, end: orig.end },
            skipUndo: true,
            eventSource: "rollback",
          });
          addLog(`  ↩ revenu à ${isoDate(orig.start)}→${isoDate(orig.end)}`);
        }
      }
    });

    // Liens : même schéma (add-link → API → rollback via delete-link si refus).
    api.on("add-link", async (ev) => {
      addLog(`add-link id=${String(ev.id)} ${String(ev.link?.source)}→${String(ev.link?.target)}`);
      try {
        await persistLink();
        addLog(`  ✓ lien persisté id=${String(ev.id)}`);
      } catch {
        addLog(`  ✗ 409 lien id=${String(ev.id)} → rollback (delete-link)`);
        if (ev.id != null) api.exec("delete-link", { id: ev.id });
      }
    });
  };

  // Simule le COMMIT d'un drag (déplacement de deltaDays) via exec('update-task').
  const simulate = (id: TID, deltaDays: number) => {
    const api = apiRef.current;
    if (!api) return;
    const t = api.getTask(id);
    const start = new Date(t.start!);
    start.setDate(start.getDate() + deltaDays);
    const end = new Date(t.end!);
    end.setDate(end.getDate() + deltaDays);
    api.exec("update-task", { id, task: { start, end } });
  };

  return (
    <div style={{ padding: 12, font: "14px system-ui" }}>
      <h2 style={{ margin: "0 0 8px" }}>Prototype SVAR — rollback invariant au drag (Phase 2a)</h2>
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <button data-testid="move-ok" type="button" onClick={() => simulate(1, 10)}>
          Déplacer A (+10 j) → API OK
        </button>
        <button data-testid="move-409" type="button" onClick={() => simulate(2, 10)}>
          Déplacer B (+10 j) → 409 → rollback
        </button>
        <button
          data-testid="link-409"
          type="button"
          onClick={() => apiRef.current?.exec("add-link", { link: { source: 1, target: 2, type: "e2s" } })}
        >
          Lier A→B (refusé) → rollback
        </button>
      </div>
      <pre data-testid="log" style={{ background: "#0b1021", color: "#cbe", padding: 10, minHeight: 90, whiteSpace: "pre-wrap" }}>
        {log.join("\n") || "(journal des événements)"}
      </pre>
      <div style={{ height: "48vh", border: "1px solid #e5e7eb", marginTop: 8 }}>
        <Willow>
          <Gantt tasks={TASKS} links={LINKS} scales={SCALES} cellWidth={38} init={onInit} />
        </Willow>
      </div>
    </div>
  );
}
