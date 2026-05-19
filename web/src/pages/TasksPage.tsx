import { useEffect, useMemo, useState } from "react";
import { projects, tasks, users } from "../api/endpoints";
import { ErrorBanner } from "../components/ErrorBanner";
import { TASK_STATUS_LABELS, fmtDate } from "../labels";
import type { Project, Task, TaskStatus, User } from "../types";

const STATUTS: TaskStatus[] = ["prevu", "en_cours", "realise", "abandonne"];

export default function TasksPage() {
  const [items, setItems] = useState<Task[]>([]);
  const [projs, setProjs] = useState<Project[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [err, setErr] = useState<unknown>(null);
  const [draft, setDraft] = useState<Partial<Task>>({
    nom: "",
    date_debut: "",
    date_fin: "",
    avancement: 0,
    statut: "prevu",
  });

  function load() {
    Promise.all([tasks.list(), projects.list(), users.list()])
      .then(([t, p, u]) => {
        setItems(t);
        setProjs(p);
        setAllUsers(u);
      })
      .catch(setErr);
  }
  useEffect(load, []);

  const projNameById = useMemo(() => {
    const m = new Map<number, string>();
    projs.forEach((p) => m.set(p.id, p.nom));
    return m;
  }, [projs]);

  const userNameById = useMemo(() => {
    const m = new Map<number, string>();
    allUsers.forEach((u) => m.set(u.id, u.nom));
    return m;
  }, [allUsers]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      await tasks.create(draft);
      setDraft({ nom: "", date_debut: "", date_fin: "", avancement: 0, statut: "prevu" });
      load();
    } catch (e) {
      setErr(e);
    }
  }

  async function remove(id: number) {
    if (!confirm("Supprimer cette tâche ?")) return;
    try {
      await tasks.remove(id);
      load();
    } catch (e) {
      setErr(e);
    }
  }

  return (
    <>
      <h2>Tâches</h2>
      <ErrorBanner error={err} />
      <form className="form" onSubmit={create} style={{ marginBottom: 24 }}>
        <label>Projet</label>
        <select
          value={draft.projet_id ?? ""}
          onChange={(e) =>
            setDraft({ ...draft, projet_id: e.target.value ? Number(e.target.value) : undefined })
          }
          required
        >
          <option value="">—</option>
          {projs.map((p) => (
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
          {allUsers.map((u) => (
            <option key={u.id} value={u.id}>{u.nom}</option>
          ))}
        </select>
        <label>Statut</label>
        <select
          value={draft.statut}
          onChange={(e) => setDraft({ ...draft, statut: e.target.value as TaskStatus })}
        >
          {STATUTS.map((s) => (
            <option key={s} value={s}>{TASK_STATUS_LABELS[s]}</option>
          ))}
        </select>
        <button className="btn" type="submit">Ajouter</button>
      </form>

      <table>
        <thead>
          <tr>
            <th>Projet</th><th>Nom</th><th>Début</th><th>Fin</th>
            <th>Avancement</th><th>Responsable</th><th>Statut</th><th></th>
          </tr>
        </thead>
        <tbody>
          {items.map((t) => (
            <tr key={t.id}>
              <td>{projNameById.get(t.projet_id) ?? t.projet_id}</td>
              <td>{t.nom}</td>
              <td>{fmtDate(t.date_debut)}</td>
              <td>{fmtDate(t.date_fin)}</td>
              <td>{t.avancement}%</td>
              <td>{t.responsable_id ? userNameById.get(t.responsable_id) ?? "—" : "—"}</td>
              <td><span className={`tag ${t.statut}`}>{TASK_STATUS_LABELS[t.statut]}</span></td>
              <td><button className="btn danger" onClick={() => remove(t.id)}>Supprimer</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
