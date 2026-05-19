import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { projects, tasks, users } from "../api/endpoints";
import { ErrorBanner } from "../components/ErrorBanner";
import { TASK_STATUS_LABELS } from "../labels";
import type { Project, Task, TaskStatus, User } from "../types";

const STATUTS: TaskStatus[] = ["prevu", "en_cours", "realise", "abandonne"];

export default function TaskNewPage() {
  const nav = useNavigate();
  const [err, setErr] = useState<unknown>(null);
  const [projs, setProjs] = useState<Project[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [draft, setDraft] = useState<Partial<Task>>({
    nom: "",
    date_debut: "",
    date_fin: "",
    avancement: 0,
    statut: "prevu",
  });

  useEffect(() => {
    Promise.all([projects.list(), users.list()])
      .then(([p, u]) => {
        setProjs(p);
        setAllUsers(u);
      })
      .catch(setErr);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      await tasks.create(draft);
      nav("/tasks");
    } catch (e) {
      setErr(e);
    }
  }

  return (
    <>
      <h2>Nouvelle tâche</h2>
      <ErrorBanner error={err} />
      <form className="form" onSubmit={submit}>
        <label>Projet</label>
        <select
          value={draft.projet_id ?? ""}
          onChange={(e) => setDraft({ ...draft, projet_id: e.target.value ? Number(e.target.value) : undefined })}
          required
        >
          <option value="">—</option>
          {projs.map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}
        </select>
        <label>Nom</label>
        <input value={draft.nom ?? ""} onChange={(e) => setDraft({ ...draft, nom: e.target.value })} required />
        <label>Date de début</label>
        <input type="date" value={draft.date_debut ?? ""} onChange={(e) => setDraft({ ...draft, date_debut: e.target.value })} required />
        <label>Date de fin</label>
        <input type="date" value={draft.date_fin ?? ""} onChange={(e) => setDraft({ ...draft, date_fin: e.target.value })} required />
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
          onChange={(e) => setDraft({ ...draft, responsable_id: e.target.value ? Number(e.target.value) : null })}
        >
          <option value="">—</option>
          {allUsers.map((u) => <option key={u.id} value={u.id}>{u.nom}</option>)}
        </select>
        <label>Statut</label>
        <select value={draft.statut} onChange={(e) => setDraft({ ...draft, statut: e.target.value as TaskStatus })}>
          {STATUTS.map((s) => <option key={s} value={s}>{TASK_STATUS_LABELS[s]}</option>)}
        </select>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button className="btn" type="submit">Créer</button>
          <button type="button" className="btn secondary" onClick={() => nav("/tasks")}>Annuler</button>
        </div>
      </form>
    </>
  );
}
