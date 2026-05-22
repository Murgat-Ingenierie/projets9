import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { projects, tasks, users } from "../api/endpoints";
import { Breadcrumb } from "../components/Breadcrumb";
import { ErrorBanner } from "../components/ErrorBanner";
import { TASK_STATUS_LABELS } from "../labels";
import type { Project, Task, TaskStatus, User } from "../types";

const STATUTS: TaskStatus[] = ["ouvert", "archive"];

export default function TaskEditPage() {
  const { id = "" } = useParams();
  const taskId = Number(id);
  const nav = useNavigate();
  const [err, setErr] = useState<unknown>(null);
  const [loaded, setLoaded] = useState(false);
  const [draft, setDraft] = useState<Partial<Task>>({});
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);

  useEffect(() => {
    if (Number.isNaN(taskId)) {
      setErr(new Error("Identifiant de tâche invalide"));
      return;
    }
    Promise.all([tasks.list(), projects.list(), users.list()])
      .then(([ts, ps, us]) => {
        const t = ts.find((x) => x.id === taskId);
        if (!t) throw new Error(`Tâche ${taskId} introuvable`);
        setDraft({ ...t });
        setAllProjects(ps);
        setAllUsers(us);
        setLoaded(true);
      })
      .catch(setErr);
  }, [taskId]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      await tasks.update(taskId, draft);
      nav("/tasks");
    } catch (e) {
      setErr(e);
    }
  }

  async function remove() {
    if (!confirm("Supprimer cette tâche ?")) return;
    try {
      await tasks.remove(taskId);
      nav("/tasks");
    } catch (e) {
      setErr(e);
    }
  }

  if (!loaded && !err) return <p>Chargement…</p>;

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Planning", to: "/" },
          { label: "Tâches", to: "/tasks" },
          { label: draft.nom ?? "Tâche" },
        ]}
      />
      <h2>Modifier la tâche : {draft.nom}</h2>
      <ErrorBanner error={err} />
      <form className="form" onSubmit={save}>
        <label>Projet</label>
        <select
          value={draft.projet_id ?? ""}
          onChange={(e) =>
            setDraft({
              ...draft,
              projet_id: e.target.value ? Number(e.target.value) : undefined,
            })
          }
          required
        >
          {allProjects.map((p) => (
            <option key={p.id} value={p.id}>{p.nom}</option>
          ))}
        </select>
        <label>Nom</label>
        <input value={draft.nom ?? ""} onChange={(e) => setDraft({ ...draft, nom: e.target.value })} required />
        <label>Date de début</label>
        <input
          type="date"
          value={draft.date_debut ?? ""}
          onChange={(e) => setDraft({ ...draft, date_debut: e.target.value })}
          required
        />
        <label>Date de fin</label>
        <input
          type="date"
          value={draft.date_fin ?? ""}
          onChange={(e) => setDraft({ ...draft, date_fin: e.target.value })}
          required
        />
        <label>Avancement (%)</label>
        <input
          type="number"
          min={0}
          max={100}
          value={draft.avancement ?? 0}
          onChange={(e) => setDraft({ ...draft, avancement: Number(e.target.value) })}
        />
        <label>Responsable</label>
        <select
          value={draft.responsable_id ?? ""}
          onChange={(e) =>
            setDraft({
              ...draft,
              responsable_id: e.target.value ? Number(e.target.value) : null,
            })
          }
        >
          <option value="">—</option>
          {allUsers.map((u) => <option key={u.id} value={u.id}>{u.nom}</option>)}
        </select>
        <label>Statut</label>
        <select
          value={draft.statut ?? "ouvert"}
          onChange={(e) => setDraft({ ...draft, statut: e.target.value as TaskStatus })}
        >
          {STATUTS.map((s) => <option key={s} value={s}>{TASK_STATUS_LABELS[s]}</option>)}
        </select>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button className="btn" type="submit">Enregistrer</button>
          <button type="button" className="btn secondary" onClick={() => nav("/tasks")}>Annuler</button>
          <button type="button" className="btn danger" onClick={remove}>Supprimer</button>
        </div>
      </form>
    </>
  );
}
