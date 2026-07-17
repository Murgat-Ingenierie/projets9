import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { equipes as equipesApi, milestones as milestonesApi, projects, tacheEquipe, tasks } from "../api/endpoints";
import { Breadcrumb } from "../components/Breadcrumb";
import { ErrorBanner } from "../components/ErrorBanner";
import type { Equipe, Milestone, Project, TacheEquipe, Task } from "../types";

type CellDetail = {
  weekIdx: number;
  equipeId: number;
  total: number;
  rows: { task: Task; project: Project | undefined; hours: number }[];
};

function startOfWeek(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const wd = x.getDay(); // 0 = dimanche, 1 = lundi
  const delta = wd === 0 ? -6 : 1 - wd;
  x.setDate(x.getDate() + delta);
  x.setHours(0, 0, 0, 0);
  return x;
}

function isoYearWeek(d: Date): { week: number; year: number } {
  // ISO 8601 week number
  const target = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNr = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const diff = (target.getTime() - firstThursday.getTime()) / 86400000;
  const week = 1 + Math.round((diff - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return { week, year: target.getUTCFullYear() };
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function fmtMonthDay(d: Date): string {
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

export default function ChargeEquipesPage() {
  const nav = useNavigate();
  const [err, setErr] = useState<unknown>(null);
  const [allEquipes, setAllEquipes] = useState<Equipe[]>([]);
  const [allAllocs, setAllAllocs] = useState<TacheEquipe[]>([]);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [allMilestones, setAllMilestones] = useState<Milestone[]>([]);
  const [weeksWindow, setWeeksWindow] = useState<number>(12);
  const [selected, setSelected] = useState<CellDetail | null>(null);

  useEffect(() => {
    Promise.all([
      equipesApi.list(),
      tacheEquipe.list(),
      tasks.list(),
      projects.list(),
      milestonesApi.list(),
    ])
      .then(([eqs, alls, ts, ps, ms]) => {
        setAllEquipes(eqs);
        setAllAllocs(alls);
        setAllTasks(ts);
        setAllProjects(ps);
        setAllMilestones(ms);
      })
      .catch(setErr);
  }, []);

  // Liste des semaines de la fenêtre (lundi de chaque semaine)
  const weeks = useMemo(() => {
    const first = startOfWeek(new Date());
    return Array.from({ length: weeksWindow }, (_, i) => addDays(first, i * 7));
  }, [weeksWindow]);

  const taskById = useMemo(() => {
    const m = new Map<number, Task>();
    for (const t of allTasks) m.set(t.id, t);
    return m;
  }, [allTasks]);
  const projectById = useMemo(() => {
    const m = new Map<number, Project>();
    for (const p of allProjects) m.set(p.id, p);
    return m;
  }, [allProjects]);

  // Pour chaque (équipe, semaine) → liste { allocation, task, hours }
  type Cell = { total: number; rows: { task: Task; hours: number; alloc: TacheEquipe }[] };
  const grid = useMemo(() => {
    const out = new Map<number, Cell[]>(); // equipe.id → [par semaine]
    for (const eq of allEquipes) {
      out.set(eq.id, weeks.map(() => ({ total: 0, rows: [] })));
    }
    for (const a of allAllocs) {
      const t = taskById.get(a.tache_id);
      if (!t) continue;
      const cells = out.get(a.equipe_id);
      if (!cells) continue;
      const tStart = new Date(t.date_debut + "T00:00:00");
      const tEnd = new Date(t.date_fin + "T00:00:00");
      const totalDays = Math.max(1, daysBetween(tStart, tEnd) + 1);
      const hPerDay = a.heures_allouees / totalDays;
      for (let i = 0; i < weeks.length; i++) {
        const wStart = weeks[i];
        const wEnd = addDays(wStart, 6);
        const ovStart = tStart > wStart ? tStart : wStart;
        const ovEnd = tEnd < wEnd ? tEnd : wEnd;
        const overlap = daysBetween(ovStart, ovEnd) + 1;
        if (overlap > 0) {
          const h = overlap * hPerDay;
          cells[i].total += h;
          cells[i].rows.push({ task: t, hours: h, alloc: a });
        }
      }
    }
    return out;
  }, [allEquipes, allAllocs, weeks, taskById]);

  // Jalons par semaine
  const milestonesByWeek = useMemo(() => {
    const out = weeks.map(() => [] as Milestone[]);
    for (const m of allMilestones) {
      const d = new Date(m.date + "T00:00:00");
      for (let i = 0; i < weeks.length; i++) {
        const wStart = weeks[i];
        const wEnd = addDays(wStart, 6);
        if (d >= wStart && d <= wEnd) {
          out[i].push(m);
          break;
        }
      }
    }
    return out;
  }, [allMilestones, weeks]);

  function openCell(weekIdx: number, eq: Equipe) {
    const cell = grid.get(eq.id)?.[weekIdx];
    if (!cell || cell.rows.length === 0) {
      setSelected(null);
      return;
    }
    setSelected({
      weekIdx,
      equipeId: eq.id,
      total: cell.total,
      rows: cell.rows
        .map((r) => ({
          task: r.task,
          project: projectById.get(r.task.projet_id),
          hours: r.hours,
        }))
        .sort((a, b) => b.hours - a.hours),
    });
  }

  function focusMilestone(m: Milestone) {
    const first = (m.project_ids ?? [])[0];
    if (first) nav(`/projects/${first}/edit`);
    else nav("/milestones");
  }

  return (
    <>
      <Breadcrumb items={[{ label: "Planning", to: "/" }, { label: "Charge équipes" }]} />
      <div className="page-header" style={{ alignItems: "center" }}>
        <h2>Charge équipes</h2>
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          Période :
          <select
            value={weeksWindow}
            onChange={(e) => setWeeksWindow(Number(e.target.value))}
          >
            <option value={4}>4 sem</option>
            <option value={8}>8 sem</option>
            <option value={12}>12 sem</option>
            <option value={26}>26 sem</option>
            <option value={52}>52 sem</option>
          </select>
        </label>
      </div>
      <ErrorBanner error={err} />

      {allEquipes.length === 0 && (
        <p className="muted">Aucune équipe n'est encore définie. Va dans <a href="/equipes">Équipes</a> pour en créer.</p>
      )}

      {allEquipes.length > 0 && (
        <div style={{ overflowX: "auto", marginTop: 12 }}>
          <table className="charge-table">
            <thead>
              <tr>
                <th style={{ textAlign: "left", position: "sticky", left: 0, background: "#fafafa", zIndex: 2 }}>
                  Jalons
                </th>
                {weeks.map((w, i) => {
                  const yw = isoYearWeek(w);
                  return (
                    <th key={i} style={{ minWidth: 80, padding: 4 }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "center" }}>
                        {milestonesByWeek[i].length === 0 && <span style={{ height: 22 }} />}
                        {milestonesByWeek[i].map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            className="milestone-pill"
                            onClick={() => focusMilestone(m)}
                            title={`${m.nom} (${m.date}) — ouvrir`}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>flag</span>
                            <span className="milestone-pill-text">{m.nom}</span>
                          </button>
                        ))}
                        <div style={{ fontSize: 11, color: "#5f6368", fontWeight: 500 }}>
                          S{String(yw.week).padStart(2, "0")} · {fmtMonthDay(w)}
                        </div>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {allEquipes.map((eq) => {
                const cells = grid.get(eq.id) ?? [];
                return (
                  <tr key={eq.id}>
                    <td style={{ position: "sticky", left: 0, background: "white", fontWeight: 500, whiteSpace: "nowrap" }}>
                      {eq.nom}
                      <div style={{ fontSize: 11, color: "#5f6368", fontWeight: 400 }}>
                        {eq.temps_dispo_hebdo} h/sem
                      </div>
                    </td>
                    {cells.map((cell, i) => {
                      const cap = eq.temps_dispo_hebdo;
                      const pct = cap > 0 ? (cell.total / cap) * 100 : 0;
                      const overload = cap > 0 && cell.total > cap;
                      const empty = cell.total === 0;
                      const cls = overload
                        ? "charge-cell overload"
                        : empty
                          ? "charge-cell empty"
                          : "charge-cell";
                      const sel =
                        selected && selected.equipeId === eq.id && selected.weekIdx === i
                          ? " selected"
                          : "";
                      return (
                        <td
                          key={i}
                          className={cls + sel}
                          onClick={() => openCell(i, eq)}
                          title={`${cell.total.toFixed(1)} h / ${cap} h`}
                        >
                          {empty ? (
                            <span style={{ color: "#bdbdbd" }}>—</span>
                          ) : (
                            <>
                              <div style={{ fontWeight: 500 }}>{cell.total.toFixed(1)} h</div>
                              <div style={{ fontSize: 11 }}>{cap > 0 ? `${pct.toFixed(0)} %` : "—"}</div>
                            </>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {selected && (() => {
        const eq = allEquipes.find((e) => e.id === selected.equipeId);
        const w = weeks[selected.weekIdx];
        const yw = isoYearWeek(w);
        return (
          <div style={{ marginTop: 16, padding: 16, background: "#fafafa", borderRadius: 4 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <h3 style={{ margin: 0 }}>
                S{yw.week} · {eq?.nom} · {selected.total.toFixed(1)} h / {eq?.temps_dispo_hebdo} h
              </h3>
              <button className="btn secondary" onClick={() => setSelected(null)}>Fermer</button>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Tâche</th>
                  <th>Projet</th>
                  <th>Heures sur la semaine</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {selected.rows.map((r) => (
                  <tr key={r.task.id}>
                    <td>{r.task.nom}</td>
                    <td>{r.project?.nom ?? "—"}</td>
                    <td>{r.hours.toFixed(1)} h</td>
                    <td>
                      <button className="btn secondary" onClick={() => nav(`/tasks/${r.task.id}/edit`)}>
                        Ouvrir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })()}
    </>
  );
}
