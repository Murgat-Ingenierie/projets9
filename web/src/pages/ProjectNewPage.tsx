import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { epics, projects, users } from "../api/endpoints";
import { ErrorBanner } from "../components/ErrorBanner";
import { PROJECT_STATUS_LABELS } from "../labels";
import type { Epic, Project, ProjectStatus, User } from "../types";

const STATUTS: ProjectStatus[] = ["prevu", "en_cours", "realise", "abandonne"];

export default function ProjectNewPage() {
  const nav = useNavigate();
  const [err, setErr] = useState<unknown>(null);
  const [allEpics, setAllEpics] = useState<Epic[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [draft, setDraft] = useState<Partial<Project>>({
    epic_trigramme: "",
    nom: "",
    date_debut: "",
    date_fin: "",
    statut: "prevu",
  });

  useEffect(() => {
    Promise.all([epics.list(), users.list()])
      .then(([e, u]) => {
        setAllEpics(e);
        setAllUsers(u);
      })
      .catch(setErr);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      await projects.create(draft);
      nav("/projects");
    } catch (e) {
      setErr(e);
    }
  }

  return (
    <>
      <h2>Nouveau projet</h2>
      <ErrorBanner error={err} />
      <form className="form" onSubmit={submit}>
        <label>Epic</label>
        <select value={draft.epic_trigramme} onChange={(e) => setDraft({ ...draft, epic_trigramme: e.target.value })} required>
          <option value="">—</option>
          {allEpics.map((e) => <option key={e.trigramme} value={e.trigramme}>{e.nom}</option>)}
        </select>
        <label>Nom</label>
        <input value={draft.nom ?? ""} onChange={(e) => setDraft({ ...draft, nom: e.target.value })} required />
        <label>Date de début</label>
        <input type="date" value={draft.date_debut ?? ""} onChange={(e) => setDraft({ ...draft, date_debut: e.target.value })} required />
        <label>Date de fin</label>
        <input type="date" value={draft.date_fin ?? ""} onChange={(e) => setDraft({ ...draft, date_fin: e.target.value })} required />
        <label>Responsable</label>
        <select
          value={draft.responsable_id ?? ""}
          onChange={(e) => setDraft({ ...draft, responsable_id: e.target.value ? Number(e.target.value) : null })}
        >
          <option value="">—</option>
          {allUsers.map((u) => <option key={u.id} value={u.id}>{u.nom}</option>)}
        </select>
        <label>Statut</label>
        <select value={draft.statut} onChange={(e) => setDraft({ ...draft, statut: e.target.value as ProjectStatus })}>
          {STATUTS.map((s) => <option key={s} value={s}>{PROJECT_STATUS_LABELS[s]}</option>)}
        </select>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button className="btn" type="submit">Créer</button>
          <button type="button" className="btn secondary" onClick={() => nav("/projects")}>Annuler</button>
        </div>
      </form>
    </>
  );
}
