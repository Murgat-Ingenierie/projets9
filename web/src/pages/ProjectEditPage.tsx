import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { epics, projects, tasks, users } from "../api/endpoints";
import { Breadcrumb, type Crumb } from "../components/Breadcrumb";
import { ErrorBanner } from "../components/ErrorBanner";
import { navState, useParentCrumbs } from "../hooks/useBreadcrumbState";
import { PROJECT_STATUS_LABELS, TASK_STATUS_LABELS, fmtDate } from "../labels";
import type {
  Epic,
  Project,
  ProjectStatus,
  Task,
  TaskStatus,
  User,
} from "../types";

const STATUTS: ProjectStatus[] = ["prevu", "en_cours", "realise", "abandonne"];
const TASK_STATUTS: TaskStatus[] = ["ouvert", "archive"];

const DEFAULT_PARENT: Crumb[] = [
  { label: "Planning", to: "/" },
  { label: "Projets", to: "/projects" },
];

export default function ProjectEditPage() {
  const { id = "" } = useParams();
  const projectId = Number(id);
  const nav = useNavigate();
  const parentCrumbs = useParentCrumbs(DEFAULT_PARENT);
  const [err, setErr] = useState<unknown>(null);
  const [loaded, setLoaded] = useState(false);
  const [draft, setDraft] = useState<Partial<Project>>({});
  const [allEpics, setAllEpics] = useState<Epic[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [projectTasks, setProjectTasks] = useState<Task[]>([]);

  // Mode édition global des tâches
  const [tasksEditMode, setTasksEditMode] = useState(false);
  const [taskDrafts, setTaskDrafts] = useState<Record<number, Partial<Task>>>({});

  const userNameById = useMemo(() => {
    const m = new Map<number, string>();
    allUsers.forEach((u) => m.set(u.id, u.nom));
    return m;
  }, [allUsers]);

  function loadAll() {
    if (Number.isNaN(projectId)) {
      setErr(new Error("Identifiant projet invalide"));
      return;
    }
    Promise.all([projects.list(), epics.list(), users.list(), tasks.list(projectId)])
      .then(([ps, es, us, ts]) => {
        const p = ps.find((x) => x.id === projectId);
        if (!p) throw new Error(`Projet ${projectId} introuvable`);
        setDraft({ ...p });
        setAllEpics(es);
        setAllUsers(us);
        setProjectTasks(ts);
        setLoaded(true);
      })
      .catch(setErr);
  }
  useEffect(loadAll, [projectId]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      await projects.update(projectId, draft);
      nav("/projects");
    } catch (e) {
      setErr(e);
    }
  }

  async function remove() {
    if (!confirm("Supprimer ce projet ?")) return;
    try {
      await projects.remove(projectId);
      nav("/projects");
    } catch (e) {
      setErr(e);
    }
  }

  // --- Mode édition global des tâches ---
  function enterTasksEdit() {
    const m: Record<number, Partial<Task>> = {};
    for (const t of projectTasks) m[t.id] = { ...t };
    setTaskDrafts(m);
    setTasksEditMode(true);
    setErr(null);
  }
  function cancelTasksEdit() {
    setTasksEditMode(false);
    setTaskDrafts({});
  }
  function patchTaskDraft(tid: number, patch: Partial<Task>) {
    setTaskDrafts((prev) => ({ ...prev, [tid]: { ...prev[tid], ...patch } }));
  }
  function isDirty(t: Task, d: Partial<Task>) {
    return (
      d.nom !== t.nom ||
      d.date_debut !== t.date_debut ||
      d.date_fin !== t.date_fin ||
      d.avancement !== t.avancement ||
      d.responsable_id !== t.responsable_id ||
      d.statut !== t.statut
    );
  }
  async function saveAllTasks() {
    setErr(null);
    const errors: string[] = [];
    for (const t of projectTasks) {
      const d = taskDrafts[t.id];
      if (!d || !isDirty(t, d)) continue;
      try {
        await tasks.update(t.id, d);
      } catch (e: any) {
        errors.push(`${t.nom} → ${e.message ?? e}`);
      }
    }
    if (errors.length > 0) {
      setErr(new Error(`Tâches non sauvegardées : ${errors.join(" ; ")}`));
    } else {
      cancelTasksEdit();
    }
    loadAll();
  }
  async function removeTask(tid: number) {
    if (!confirm("Supprimer cette tâche ?")) return;
    try {
      await tasks.remove(tid);
      loadAll();
    } catch (e) {
      setErr(e);
    }
  }

  if (!loaded && !err) return <p>Chargement…</p>;

  return (
    <>
      <Breadcrumb items={[...parentCrumbs, { label: draft.nom ?? "Projet" }]} />
      <h2 style={{ marginBottom: 16 }}>Modifier le projet : {draft.nom}</h2>
      <ErrorBanner error={err} />

      <form className="form compact" onSubmit={save}>
        <div className="field">
          <label>Epic</label>
          <select
            value={draft.epic_trigramme ?? ""}
            onChange={(e) => setDraft({ ...draft, epic_trigramme: e.target.value })}
            required
          >
            {allEpics.map((e) => <option key={e.trigramme} value={e.trigramme}>{e.nom}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Nom</label>
          <input
            value={draft.nom ?? ""}
            onChange={(e) => setDraft({ ...draft, nom: e.target.value })}
            required
          />
        </div>
        <div className="field">
          <label>Statut</label>
          <select
            value={draft.statut ?? "prevu"}
            onChange={(e) => setDraft({ ...draft, statut: e.target.value as ProjectStatus })}
          >
            {STATUTS.map((s) => <option key={s} value={s}>{PROJECT_STATUS_LABELS[s]}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Date de début</label>
          <input
            type="date"
            value={draft.date_debut ?? ""}
            onChange={(e) => setDraft({ ...draft, date_debut: e.target.value })}
            required
          />
        </div>
        <div className="field">
          <label>Date de fin</label>
          <input
            type="date"
            value={draft.date_fin ?? ""}
            onChange={(e) => setDraft({ ...draft, date_fin: e.target.value })}
            required
          />
        </div>
        <div className="field">
          <label>Responsable</label>
          <select
            value={draft.responsable_id ?? ""}
            onChange={(e) => setDraft({ ...draft, responsable_id: e.target.value ? Number(e.target.value) : null })}
          >
            <option value="">—</option>
            {allUsers.map((u) => <option key={u.id} value={u.id}>{u.nom}</option>)}
          </select>
        </div>
        <div className="field full">
          <label>Description</label>
          <textarea
            rows={2}
            value={draft.description ?? ""}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          />
        </div>
        <div className="full" style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button className="btn" type="submit">Enregistrer</button>
          <button type="button" className="btn secondary" onClick={() => nav("/projects")}>Annuler</button>
          <button type="button" className="btn danger" onClick={remove}>Supprimer</button>
        </div>
      </form>

      <div className="page-header" style={{ marginTop: 24 }}>
        <h3 style={{ margin: 0 }}>Tâches du projet ({projectTasks.length})</h3>
        <div style={{ display: "flex", gap: 8 }}>
          {!tasksEditMode ? (
            <>
              {projectTasks.length > 0 && (
                <button className="btn secondary" onClick={enterTasksEdit}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16, marginRight: 4 }}>edit</span>
                  Tout éditer
                </button>
              )}
              <button
                className="btn"
                onClick={() =>
                  nav(
                    `/tasks/new?projet_id=${projectId}`,
                    navState(parentCrumbs, {
                      label: draft.nom ?? "Projet",
                      to: `/projects/${projectId}/edit`,
                    })
                  )
                }
              >
                + Ajouter une tâche
              </button>
            </>
          ) : (
            <>
              <button className="btn" onClick={saveAllTasks}>Enregistrer tout</button>
              <button className="btn secondary" onClick={cancelTasksEdit}>Annuler</button>
            </>
          )}
        </div>
      </div>

      {projectTasks.length === 0 ? (
        <p className="muted">Aucune tâche pour ce projet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Nom</th>
              <th>Début</th>
              <th>Fin</th>
              <th>Avancement</th>
              <th>Responsable</th>
              <th>Statut</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {projectTasks.map((t) => {
              if (tasksEditMode) {
                const d = taskDrafts[t.id] ?? t;
                return (
                  <tr key={t.id} className="editing">
                    <td>
                      <input
                        value={d.nom ?? ""}
                        onChange={(ev) => patchTaskDraft(t.id, { nom: ev.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        type="date"
                        value={d.date_debut ?? ""}
                        onChange={(ev) => patchTaskDraft(t.id, { date_debut: ev.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        type="date"
                        value={d.date_fin ?? ""}
                        onChange={(ev) => patchTaskDraft(t.id, { date_fin: ev.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={d.avancement ?? 0}
                        onChange={(ev) => patchTaskDraft(t.id, { avancement: Number(ev.target.value) })}
                        style={{ width: 70 }}
                      />
                    </td>
                    <td>
                      <select
                        value={d.responsable_id ?? ""}
                        onChange={(ev) =>
                          patchTaskDraft(t.id, {
                            responsable_id: ev.target.value ? Number(ev.target.value) : null,
                          })
                        }
                      >
                        <option value="">—</option>
                        {allUsers.map((u) => <option key={u.id} value={u.id}>{u.nom}</option>)}
                      </select>
                    </td>
                    <td>
                      <select
                        value={d.statut ?? "ouvert"}
                        onChange={(ev) =>
                          patchTaskDraft(t.id, { statut: ev.target.value as TaskStatus })
                        }
                      >
                        {TASK_STATUTS.map((s) => (
                          <option key={s} value={s}>{TASK_STATUS_LABELS[s]}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <button className="btn danger" onClick={() => removeTask(t.id)}>Supprimer</button>
                    </td>
                  </tr>
                );
              }
              return (
                <tr key={t.id}>
                  <td>{t.nom}</td>
                  <td>{fmtDate(t.date_debut)}</td>
                  <td>{fmtDate(t.date_fin)}</td>
                  <td>{t.avancement}%</td>
                  <td>{t.responsable_id ? userNameById.get(t.responsable_id) ?? "—" : "—"}</td>
                  <td><span className={`tag ${t.statut}`}>{TASK_STATUS_LABELS[t.statut]}</span></td>
                  <td></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </>
  );
}
