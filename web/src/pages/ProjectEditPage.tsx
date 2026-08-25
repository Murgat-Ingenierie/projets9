import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { projects, tasks, users } from "../api/endpoints";
import { Breadcrumb, type Crumb } from "../components/Breadcrumb";
import { ErrorBanner } from "../components/ErrorBanner";
import { ProjectEditor } from "../components/ProjectEditor";
import { UserSelect } from "../components/selects";
import { Switch } from "../components/Switch";
import { navState, useParentCrumbs } from "../hooks/useBreadcrumbState";
import { fmtDate } from "../labels";
import type { Project, Task } from "../types";
import { BoutonSupprimer } from "../components/BoutonSupprimer";

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
  const [project, setProject] = useState<Project | null>(null);
  const [allUsers, setAllUsers] = useState<{ id: number; nom: string }[]>([]);
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
    Promise.all([projects.list(), users.annuaire(), tasks.list(projectId)])
      .then(([ps, us, ts]) => {
        const p = ps.find((x) => x.id === projectId);
        if (!p) throw new Error(`Projet ${projectId} introuvable`);
        setProject(p);
        setAllUsers(us);
        setProjectTasks(ts);
      })
      .catch(setErr);
  }
  useEffect(loadAll, [projectId]);

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

  if (Number.isNaN(projectId)) return <p>Identifiant projet invalide</p>;

  return (
    <>
      <Breadcrumb items={[...parentCrumbs, { label: project?.nom ?? "Projet" }]} />
      <h2 style={{ marginBottom: 16 }}>Modifier le projet : {project?.nom ?? ""}</h2>
      <ErrorBanner error={err} />

      <ProjectEditor
        projectId={projectId}
        onSaved={() => nav("/projects")}
        onCancel={() => nav("/projects")}
        showDelete
      />

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
                      label: project?.nom ?? "Projet",
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
              <th>Responsable</th>
              <th>Fini</th>
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
                      <UserSelect
                        value={d.responsable_id ?? null}
                        onChange={(id) => patchTaskDraft(t.id, { responsable_id: id })}
                        users={allUsers}
                      />
                    </td>
                    <td>
                      <Switch
                        checked={d.statut === "archive"}
                        onChange={(c) => patchTaskDraft(t.id, { statut: c ? "archive" : "ouvert" })}
                      />
                    </td>
                    <td>
                      <BoutonSupprimer onClick={() => removeTask(t.id)}>Supprimer</BoutonSupprimer>
                    </td>
                  </tr>
                );
              }
              return (
                <tr key={t.id}>
                  <td>{t.nom}</td>
                  <td>{fmtDate(t.date_debut)}</td>
                  <td>{fmtDate(t.date_fin)}</td>
                  <td>{t.responsable_id ? userNameById.get(t.responsable_id) ?? "—" : "—"}</td>
                  <td>
                    {t.statut === "archive" ? (
                      <span className="material-symbols-outlined" style={{ fontSize: 18, color: "#2e7d32" }}>check_circle</span>
                    ) : (
                      <span style={{ color: "#bdbdbd" }}>—</span>
                    )}
                  </td>
                  {/* Les tâches du projet étaient listées mais sans issue : on
                      lisait un nom sans pouvoir l'ouvrir. Le fil d'Ariane reprend
                      le projet comme parent, pour que le retour ramène ici et non
                      à la liste générale des tâches. */}
                  <td className="row-actions">
                    <button
                      className="btn secondary"
                      onClick={() =>
                        nav(
                          `/tasks/${t.id}/edit`,
                          navState(parentCrumbs, {
                            label: project?.nom ?? "Projet",
                            to: `/projects/${projectId}/edit`,
                          })
                        )
                      }
                    >
                      Ouvrir
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </>
  );
}
