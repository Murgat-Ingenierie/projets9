import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { epics, milestones, projects } from "../api/endpoints";
import { Breadcrumb, type Crumb } from "../components/Breadcrumb";
import { ErrorBanner } from "../components/ErrorBanner";
import { useParentCrumbs } from "../hooks/useBreadcrumbState";
import type { Epic, Milestone, Project } from "../types";

const DEFAULT_PARENT: Crumb[] = [
  { label: "Planning", to: "/" },
  { label: "Jalons", to: "/milestones" },
];

export default function MilestoneNewPage() {
  const nav = useNavigate();
  const parentCrumbs = useParentCrumbs(DEFAULT_PARENT);
  const [err, setErr] = useState<unknown>(null);
  const [allEpics, setAllEpics] = useState<Epic[]>([]);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [parentType, setParentType] = useState<"epic" | "project">("epic");
  const [draft, setDraft] = useState<Partial<Milestone>>({
    nom: "",
    date: "",
    atteint: false,
    epic_trigramme: null,
    project_id: null,
  });

  useEffect(() => {
    Promise.all([epics.list(), projects.list()])
      .then(([e, p]) => {
        setAllEpics(e);
        setAllProjects(p);
      })
      .catch(setErr);
  }, []);

  async function submit(e: React.FormEvent) {
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
      nav("/milestones");
    } catch (e) {
      setErr(e);
    }
  }

  return (
    <>
      <Breadcrumb items={[...parentCrumbs, { label: "Nouveau jalon" }]} />
      <h2>Nouveau jalon</h2>
      <ErrorBanner error={err} />
      <form className="form" onSubmit={submit}>
        <label>Rattaché à</label>
        <select value={parentType} onChange={(e) => setParentType(e.target.value as "epic" | "project")}>
          <option value="epic">Un epic</option>
          <option value="project">Un projet</option>
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
              {allEpics.map((e) => <option key={e.trigramme} value={e.trigramme}>{e.nom}</option>)}
            </select>
          </>
        ) : (
          <>
            <label>Projet</label>
            <select
              value={draft.project_id ?? ""}
              onChange={(e) => setDraft({ ...draft, project_id: e.target.value ? Number(e.target.value) : null })}
              required
            >
              <option value="">—</option>
              {allProjects.map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}
            </select>
          </>
        )}
        <label>Nom</label>
        <input value={draft.nom ?? ""} onChange={(e) => setDraft({ ...draft, nom: e.target.value })} required />
        <label>Date</label>
        <input type="date" value={draft.date ?? ""} onChange={(e) => setDraft({ ...draft, date: e.target.value })} required />
        <label>
          <input
            type="checkbox"
            checked={!!draft.atteint}
            onChange={(e) => setDraft({ ...draft, atteint: e.target.checked })}
          />
          {" "}Atteint
        </label>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button className="btn" type="submit">Créer</button>
          <button type="button" className="btn secondary" onClick={() => nav("/milestones")}>Annuler</button>
        </div>
      </form>
    </>
  );
}
