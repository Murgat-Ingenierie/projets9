import { useEffect, useId, useState } from "react";
import { useNavigate } from "react-router-dom";
import { dependencies, projects, tasks } from "../api/endpoints";
import { Breadcrumb, type Crumb } from "../components/Breadcrumb";
import { ErrorBanner } from "../components/ErrorBanner";
import { useParentCrumbs } from "../hooks/useBreadcrumbState";
import type { Dependency, DependencyType, Project, Task } from "../types";

const TYPES: DependencyType[] = ["FS", "SS", "FF"];
const TYPE_LABELS: Record<DependencyType, string> = {
  FS: "Fin → Début (FS)",
  SS: "Début → Début (SS)",
  FF: "Fin → Fin (FF)",
};

const DEFAULT_PARENT: Crumb[] = [
  { label: "Planning", to: "/" },
  { label: "Dépendances", to: "/dependencies" },
];

export default function DependencyNewPage() {
  const id = useId();
  const nav = useNavigate();
  const parentCrumbs = useParentCrumbs(DEFAULT_PARENT);
  const [err, setErr] = useState<unknown>(null);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [draft, setDraft] = useState<Partial<Dependency>>({ type: "FS" });

  useEffect(() => {
    Promise.all([tasks.list(), projects.list()])
      .then(([t, p]) => {
        setAllTasks(t);
        setAllProjects(p);
      })
      .catch(setErr);
  }, []);

  // L'amont est une tâche OU la fin d'un projet (#141) : un seul sélecteur, dont
  // la valeur porte le genre ("task:<id>" / "proj:<id>"), plutôt que deux champs
  // dont il faudrait garantir qu'un seul est rempli.
  const amont =
    draft.projet_amont_id != null ? `proj:${draft.projet_amont_id}`
    : draft.tache_amont_id != null ? `task:${draft.tache_amont_id}`
    : "";

  function choisirAmont(valeur: string) {
    const [genre, ref] = valeur.split(":");
    const id = ref ? Number(ref) : undefined;
    setDraft({
      ...draft,
      tache_amont_id: genre === "task" ? id : undefined,
      projet_amont_id: genre === "proj" ? id : undefined,
      // Un projet ne précède que par sa fin : seul FS a un sens.
      type: genre === "proj" ? "FS" : draft.type,
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      await dependencies.create(draft);
      nav("/dependencies");
    } catch (e) {
      setErr(e);
    }
  }

  return (
    <>
      <Breadcrumb items={[...parentCrumbs, { label: "Nouvelle dépendance" }]} />
      <h2>Nouvelle dépendance</h2>
      <ErrorBanner error={err} />
      <form className="form" onSubmit={submit}>
        <label htmlFor={`${id}-amont`}>Amont</label>
        <select
          id={`${id}-amont`}
          value={amont}
          onChange={(e) => choisirAmont(e.target.value)}
          required
        >
          <option value="">—</option>
          <optgroup label="Tâches">
            {allTasks.map((t) => <option key={t.id} value={`task:${t.id}`}>{t.nom}</option>)}
          </optgroup>
          <optgroup label="Fin de projet">
            {allProjects.map((p) => <option key={p.id} value={`proj:${p.id}`}>Fin du projet {p.nom}</option>)}
          </optgroup>
        </select>
        <label htmlFor={`${id}-aval`}>Tâche aval</label>
        <select
          id={`${id}-aval`}
          value={draft.tache_aval_id ?? ""}
          onChange={(e) => setDraft({ ...draft, tache_aval_id: e.target.value ? Number(e.target.value) : undefined })}
          required
        >
          <option value="">—</option>
          {allTasks.map((t) => <option key={t.id} value={t.id}>{t.nom}</option>)}
        </select>
        <label htmlFor={`${id}-type`}>Type</label>
        <select
          id={`${id}-type`}
          value={draft.type}
          onChange={(e) => setDraft({ ...draft, type: e.target.value as DependencyType })}
          disabled={draft.projet_amont_id != null}
        >
          {TYPES.map((s) => <option key={s} value={s}>{TYPE_LABELS[s]}</option>)}
        </select>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button className="btn" type="submit">Créer</button>
          <button type="button" className="btn secondary" onClick={() => nav("/dependencies")}>Annuler</button>
        </div>
      </form>
    </>
  );
}
