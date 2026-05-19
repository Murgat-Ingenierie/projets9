import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { epics, projects, users } from "../api/endpoints";
import { ErrorBanner } from "../components/ErrorBanner";
import { PROJECT_STATUS_LABELS } from "../labels";
import type { Epic, Project, ProjectStatus, User } from "../types";

const STATUTS: ProjectStatus[] = ["prevu", "en_cours", "realise", "abandonne"];

export default function ProjectEditPage() {
  const { id = "" } = useParams();
  const projectId = Number(id);
  const nav = useNavigate();
  const [err, setErr] = useState<unknown>(null);
  const [loaded, setLoaded] = useState(false);
  const [draft, setDraft] = useState<Partial<Project>>({});
  const [allEpics, setAllEpics] = useState<Epic[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);

  useEffect(() => {
    if (Number.isNaN(projectId)) {
      setErr(new Error("Identifiant projet invalide"));
      return;
    }
    Promise.all([projects.list(), epics.list(), users.list()])
      .then(([ps, es, us]) => {
        const p = ps.find((x) => x.id === projectId);
        if (!p) throw new Error(`Projet ${projectId} introuvable`);
        setDraft({ ...p });
        setAllEpics(es);
        setAllUsers(us);
        setLoaded(true);
      })
      .catch(setErr);
  }, [projectId]);

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

  if (!loaded && !err) return <p>Chargement…</p>;

  return (
    <>
      <h2>Modifier le projet : {draft.nom}</h2>
      <ErrorBanner error={err} />
      <form className="form" onSubmit={save}>
        <label>Epic</label>
        <select
          value={draft.epic_trigramme ?? ""}
          onChange={(e) => setDraft({ ...draft, epic_trigramme: e.target.value })}
          required
        >
          {allEpics.map((e) => <option key={e.trigramme} value={e.trigramme}>{e.nom}</option>)}
        </select>
        <label>Nom</label>
        <input value={draft.nom ?? ""} onChange={(e) => setDraft({ ...draft, nom: e.target.value })} required />
        <label>Description</label>
        <textarea
          value={draft.description ?? ""}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
        />
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
        <label>Responsable</label>
        <select
          value={draft.responsable_id ?? ""}
          onChange={(e) => setDraft({ ...draft, responsable_id: e.target.value ? Number(e.target.value) : null })}
        >
          <option value="">—</option>
          {allUsers.map((u) => <option key={u.id} value={u.id}>{u.nom}</option>)}
        </select>
        <label>Statut</label>
        <select
          value={draft.statut ?? "prevu"}
          onChange={(e) => setDraft({ ...draft, statut: e.target.value as ProjectStatus })}
        >
          {STATUTS.map((s) => <option key={s} value={s}>{PROJECT_STATUS_LABELS[s]}</option>)}
        </select>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button className="btn" type="submit">Enregistrer</button>
          <button type="button" className="btn secondary" onClick={() => nav("/projects")}>Annuler</button>
          <button type="button" className="btn danger" onClick={remove}>Supprimer</button>
        </div>
      </form>
    </>
  );
}
