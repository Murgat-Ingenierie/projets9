import { useEffect, useMemo, useState } from "react";
import { epics, projects, users } from "../api/endpoints";
import { ErrorBanner } from "../components/ErrorBanner";
import { PROJECT_STATUS_LABELS, fmtDate } from "../labels";
import type { Epic, Project, ProjectStatus, User } from "../types";

const STATUTS: ProjectStatus[] = ["prevu", "en_cours", "realise", "abandonne"];

export default function ProjectsPage() {
  const [items, setItems] = useState<Project[]>([]);
  const [allEpics, setAllEpics] = useState<Epic[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [err, setErr] = useState<unknown>(null);
  const [draft, setDraft] = useState<Partial<Project>>({
    epic_trigramme: "",
    nom: "",
    date_debut: "",
    date_fin: "",
    statut: "prevu",
  });

  function load() {
    Promise.all([projects.list(), epics.list(), users.list()])
      .then(([p, e, u]) => {
        setItems(p);
        setAllEpics(e);
        setAllUsers(u);
      })
      .catch(setErr);
  }
  useEffect(load, []);

  const epicNameByTri = useMemo(() => {
    const m = new Map<string, string>();
    allEpics.forEach((e) => m.set(e.trigramme, e.nom));
    return m;
  }, [allEpics]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      await projects.create(draft);
      setDraft({ epic_trigramme: "", nom: "", date_debut: "", date_fin: "", statut: "prevu" });
      load();
    } catch (e) {
      setErr(e);
    }
  }

  async function remove(id: number) {
    if (!confirm("Supprimer ce projet ?")) return;
    try {
      await projects.remove(id);
      load();
    } catch (e) {
      setErr(e);
    }
  }

  return (
    <>
      <h2>Projets</h2>
      <ErrorBanner error={err} />
      <form className="form" onSubmit={create} style={{ marginBottom: 24 }}>
        <label>Epic</label>
        <select
          value={draft.epic_trigramme}
          onChange={(e) => setDraft({ ...draft, epic_trigramme: e.target.value })}
          required
        >
          <option value="">—</option>
          {allEpics.map((e) => (
            <option key={e.trigramme} value={e.trigramme}>{e.nom}</option>
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
          onChange={(e) => setDraft({ ...draft, statut: e.target.value as ProjectStatus })}
        >
          {STATUTS.map((s) => (
            <option key={s} value={s}>{PROJECT_STATUS_LABELS[s]}</option>
          ))}
        </select>
        <button className="btn" type="submit">Ajouter</button>
      </form>

      <table>
        <thead>
          <tr>
            <th>Epic</th><th>Nom</th><th>Début</th><th>Fin</th><th>Statut</th><th></th>
          </tr>
        </thead>
        <tbody>
          {items.map((p) => (
            <tr key={p.id}>
              <td>{epicNameByTri.get(p.epic_trigramme) ?? p.epic_trigramme}</td>
              <td>{p.nom}</td>
              <td>{fmtDate(p.date_debut)}</td>
              <td>{fmtDate(p.date_fin)}</td>
              <td><span className={`tag ${p.statut}`}>{PROJECT_STATUS_LABELS[p.statut]}</span></td>
              <td><button className="btn danger" onClick={() => remove(p.id)}>Supprimer</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
