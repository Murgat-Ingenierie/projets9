import { useEffect, useState } from "react";
import { epics, milestones, projects } from "../api/endpoints";
import { ErrorBanner } from "../components/ErrorBanner";
import type { Epic, Milestone, Project } from "../types";

export default function MilestonesPage() {
  const [items, setItems] = useState<Milestone[]>([]);
  const [allEpics, setAllEpics] = useState<Epic[]>([]);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [err, setErr] = useState<unknown>(null);
  const [parentType, setParentType] = useState<"epic" | "project">("epic");
  const [draft, setDraft] = useState<Partial<Milestone>>({
    nom: "",
    date: "",
    atteint: false,
    epic_trigramme: null,
    project_id: null,
  });

  function load() {
    Promise.all([milestones.list(), epics.list(), projects.list()])
      .then(([m, e, p]) => {
        setItems(m);
        setAllEpics(e);
        setAllProjects(p);
      })
      .catch(setErr);
  }
  useEffect(load, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      const payload: Partial<Milestone> = {
        nom: draft.nom,
        date: draft.date,
        atteint: draft.atteint ?? false,
        epic_trigramme: parentType === "epic" ? draft.epic_trigramme : null,
        project_id: parentType === "project" ? draft.project_id : null,
      };
      await milestones.create(payload);
      setDraft({ nom: "", date: "", atteint: false, epic_trigramme: null, project_id: null });
      load();
    } catch (e) {
      setErr(e);
    }
  }

  async function remove(id: number) {
    if (!confirm("Supprimer ce jalon ?")) return;
    try {
      await milestones.remove(id);
      load();
    } catch (e) {
      setErr(e);
    }
  }

  return (
    <>
      <h2>Jalons</h2>
      <ErrorBanner error={err} />
      <form className="form" onSubmit={create} style={{ marginBottom: 24 }}>
        <label>Rattaché à</label>
        <select value={parentType} onChange={(e) => setParentType(e.target.value as "epic" | "project")}>
          <option value="epic">Epic</option>
          <option value="project">Projet</option>
        </select>
        {parentType === "epic" ? (
          <>
            <label>Epic</label>
            <select
              value={draft.epic_trigramme ?? ""}
              onChange={(e) => setDraft({ ...draft, epic_trigramme: e.target.value || null })}
              required
            >
              <option value="">—</option>
              {allEpics.map((e) => (
                <option key={e.trigramme} value={e.trigramme}>{e.trigramme} — {e.nom}</option>
              ))}
            </select>
          </>
        ) : (
          <>
            <label>Projet</label>
            <select
              value={draft.project_id ?? ""}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  project_id: e.target.value ? Number(e.target.value) : null,
                })
              }
              required
            >
              <option value="">—</option>
              {allProjects.map((p) => (
                <option key={p.id} value={p.id}>{p.nom}</option>
              ))}
            </select>
          </>
        )}
        <label>Nom</label>
        <input value={draft.nom ?? ""} onChange={(e) => setDraft({ ...draft, nom: e.target.value })} required />
        <label>Date</label>
        <input
          type="date"
          value={draft.date ?? ""}
          onChange={(e) => setDraft({ ...draft, date: e.target.value })}
          required
        />
        <label>
          <input
            type="checkbox"
            checked={!!draft.atteint}
            onChange={(e) => setDraft({ ...draft, atteint: e.target.checked })}
          />
          {" "}Atteint
        </label>
        <button className="btn" type="submit">Ajouter</button>
      </form>

      <table>
        <thead>
          <tr>
            <th>ID</th><th>Rattaché à</th><th>Nom</th><th>Date</th><th>Atteint</th><th></th>
          </tr>
        </thead>
        <tbody>
          {items.map((m) => (
            <tr key={m.id}>
              <td>{m.id}</td>
              <td>{m.epic_trigramme ?? `proj#${m.project_id}`}</td>
              <td>{m.nom}</td>
              <td>{m.date}</td>
              <td>{m.atteint ? "oui" : "non"}</td>
              <td><button className="btn danger" onClick={() => remove(m.id)}>Supprimer</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
