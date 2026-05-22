import { useEffect, useState } from "react";
import { epics, projects, tasks, users } from "../api/endpoints";
import {
  EPIC_CATEGORY_LABELS,
  EPIC_STATUS_LABELS,
  PROJECT_STATUS_LABELS,
  TASK_STATUS_LABELS,
} from "../labels";
import type {
  Epic,
  EpicCategory,
  EpicStatus,
  Project,
  ProjectStatus,
  Task,
  TaskStatus,
  User,
} from "../types";
import { ErrorBanner } from "./ErrorBanner";

export type PanelTarget =
  | { type: "epic"; trigramme: string }
  | { type: "project"; id: number }
  | { type: "task"; id: number };

interface Props {
  target: PanelTarget | null;
  onClose: () => void;
  onSaved: () => void;
}

const EPIC_STATUTS: EpicStatus[] = ["idee", "actif", "realise", "abandonne"];
const EPIC_CATEGORIES: EpicCategory[] = ["operationnel", "strategique", "long_terme"];
const PROJECT_STATUTS: ProjectStatus[] = ["prevu", "en_cours", "realise", "abandonne"];
const TASK_STATUTS: TaskStatus[] = ["prevu", "en_cours", "realise", "abandonne"];

function PanelHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="panel-header">
      <h3 style={{ margin: 0 }}>{title}</h3>
      <button type="button" className="panel-close" onClick={onClose} title="Fermer">
        <span className="material-symbols-outlined">close</span>
      </button>
    </div>
  );
}

function EpicForm({ trigramme, onClose, onSaved }: { trigramme: string; onClose: () => void; onSaved: () => void }) {
  const [draft, setDraft] = useState<Partial<Epic>>({});
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState<unknown>(null);

  useEffect(() => {
    epics.get(trigramme).then((e) => { setDraft({ ...e }); setLoaded(true); }).catch(setErr);
  }, [trigramme]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      await epics.update(trigramme, draft);
      onSaved();
      onClose();
    } catch (e) { setErr(e); }
  }
  async function remove() {
    if (!confirm(`Supprimer l'epic "${trigramme}" et tous ses projets ?`)) return;
    setErr(null);
    try {
      await epics.remove(trigramme);
      onSaved();
      onClose();
    } catch (e) { setErr(e); }
  }

  return (
    <>
      <PanelHeader title={loaded ? `Epic : ${draft.nom}` : "Chargement…"} onClose={onClose} />
      <div className="panel-body">
        <ErrorBanner error={err} />
        {loaded && (
          <form className="form" onSubmit={save} style={{ boxShadow: "none", padding: 0, background: "transparent" }}>
            <label>Nom</label>
            <input value={draft.nom ?? ""} onChange={(e) => setDraft({ ...draft, nom: e.target.value })} required />
            <label>Critère de réussite</label>
            <textarea
              rows={2}
              value={draft.critere_reussite ?? ""}
              onChange={(e) => setDraft({ ...draft, critere_reussite: e.target.value })}
            />
            <label>Raison de la date de fin</label>
            <input
              value={draft.raison_date_fin ?? ""}
              onChange={(e) => setDraft({ ...draft, raison_date_fin: e.target.value })}
            />
            <label>Date de fin prévue</label>
            <input
              type="date"
              value={draft.date_fin_prevue ?? ""}
              onChange={(e) => setDraft({ ...draft, date_fin_prevue: e.target.value || null })}
            />
            <label>Jalon de fin maximum</label>
            <input
              type="date"
              value={draft.jalon_fin_max ?? ""}
              onChange={(e) => setDraft({ ...draft, jalon_fin_max: e.target.value || null })}
            />
            <label>Statut</label>
            <select
              value={draft.statut ?? "idee"}
              onChange={(e) => setDraft({ ...draft, statut: e.target.value as EpicStatus })}
            >
              {EPIC_STATUTS.map((s) => <option key={s} value={s}>{EPIC_STATUS_LABELS[s]}</option>)}
            </select>
            <label>Catégorie</label>
            <select
              value={draft.categorie ?? "operationnel"}
              onChange={(e) => setDraft({ ...draft, categorie: e.target.value as EpicCategory })}
            >
              {EPIC_CATEGORIES.map((c) => <option key={c} value={c}>{EPIC_CATEGORY_LABELS[c]}</option>)}
            </select>
            <label>Couleur</label>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="color"
                value={draft.couleur ?? "#3f51b5"}
                onChange={(e) => setDraft({ ...draft, couleur: e.target.value })}
                style={{ width: 48, height: 32, padding: 0, cursor: "pointer", border: "1px solid #e0e0e0", borderRadius: 4 }}
              />
              <code style={{ color: "#5f6368", fontSize: 12 }}>{draft.couleur ?? "(défaut)"}</code>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button className="btn" type="submit">Enregistrer</button>
              <button type="button" className="btn secondary" onClick={onClose}>Annuler</button>
              <button type="button" className="btn danger" onClick={remove}>Supprimer</button>
            </div>
          </form>
        )}
      </div>
    </>
  );
}

function ProjectForm({ id, onClose, onSaved }: { id: number; onClose: () => void; onSaved: () => void }) {
  const [draft, setDraft] = useState<Partial<Project>>({});
  const [allEpics, setAllEpics] = useState<Epic[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState<unknown>(null);

  useEffect(() => {
    Promise.all([projects.list(), epics.list(), users.list()])
      .then(([ps, es, us]) => {
        const p = ps.find((x) => x.id === id);
        if (!p) throw new Error(`Projet ${id} introuvable`);
        setDraft({ ...p });
        setAllEpics(es);
        setAllUsers(us);
        setLoaded(true);
      })
      .catch(setErr);
  }, [id]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      await projects.update(id, draft);
      onSaved();
      onClose();
    } catch (e) { setErr(e); }
  }
  async function remove() {
    if (!confirm("Supprimer ce projet ?")) return;
    setErr(null);
    try {
      await projects.remove(id);
      onSaved();
      onClose();
    } catch (e) { setErr(e); }
  }

  return (
    <>
      <PanelHeader title={loaded ? `Projet : ${draft.nom}` : "Chargement…"} onClose={onClose} />
      <div className="panel-body">
        <ErrorBanner error={err} />
        {loaded && (
          <form className="form" onSubmit={save} style={{ boxShadow: "none", padding: 0, background: "transparent" }}>
            <label>Epic</label>
            <select
              value={draft.epic_trigramme ?? ""}
              onChange={(e) => setDraft({ ...draft, epic_trigramme: e.target.value })}
              required
            >
              {allEpics.map((e) => <option key={e.trigramme} value={e.trigramme}>{e.nom}</option>)}
            </select>
            <label>Nom</label>
            <input
              value={draft.nom ?? ""}
              onChange={(e) => setDraft({ ...draft, nom: e.target.value })}
              required
            />
            <label>Description</label>
            <textarea
              rows={2}
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
              onChange={(e) =>
                setDraft({ ...draft, responsable_id: e.target.value ? Number(e.target.value) : null })
              }
            >
              <option value="">—</option>
              {allUsers.map((u) => <option key={u.id} value={u.id}>{u.nom}</option>)}
            </select>
            <label>Statut</label>
            <select
              value={draft.statut ?? "prevu"}
              onChange={(e) => setDraft({ ...draft, statut: e.target.value as ProjectStatus })}
            >
              {PROJECT_STATUTS.map((s) => <option key={s} value={s}>{PROJECT_STATUS_LABELS[s]}</option>)}
            </select>
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button className="btn" type="submit">Enregistrer</button>
              <button type="button" className="btn secondary" onClick={onClose}>Annuler</button>
              <button type="button" className="btn danger" onClick={remove}>Supprimer</button>
            </div>
          </form>
        )}
      </div>
    </>
  );
}

function TaskForm({ id, onClose, onSaved }: { id: number; onClose: () => void; onSaved: () => void }) {
  const [draft, setDraft] = useState<Partial<Task>>({});
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState<unknown>(null);

  useEffect(() => {
    Promise.all([tasks.list(), projects.list(), users.list()])
      .then(([ts, ps, us]) => {
        const t = ts.find((x) => x.id === id);
        if (!t) throw new Error(`Tâche ${id} introuvable`);
        setDraft({ ...t });
        setAllProjects(ps);
        setAllUsers(us);
        setLoaded(true);
      })
      .catch(setErr);
  }, [id]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      await tasks.update(id, draft);
      onSaved();
      onClose();
    } catch (e) { setErr(e); }
  }
  async function remove() {
    if (!confirm("Supprimer cette tâche ?")) return;
    setErr(null);
    try {
      await tasks.remove(id);
      onSaved();
      onClose();
    } catch (e) { setErr(e); }
  }

  return (
    <>
      <PanelHeader title={loaded ? `Tâche : ${draft.nom}` : "Chargement…"} onClose={onClose} />
      <div className="panel-body">
        <ErrorBanner error={err} />
        {loaded && (
          <form className="form" onSubmit={save} style={{ boxShadow: "none", padding: 0, background: "transparent" }}>
            <label>Projet</label>
            <select
              value={draft.projet_id ?? ""}
              onChange={(e) =>
                setDraft({ ...draft, projet_id: e.target.value ? Number(e.target.value) : undefined })
              }
              required
            >
              {allProjects.map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}
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
                setDraft({ ...draft, responsable_id: e.target.value ? Number(e.target.value) : null })
              }
            >
              <option value="">—</option>
              {allUsers.map((u) => <option key={u.id} value={u.id}>{u.nom}</option>)}
            </select>
            <label>Statut</label>
            <select
              value={draft.statut ?? "prevu"}
              onChange={(e) => setDraft({ ...draft, statut: e.target.value as TaskStatus })}
            >
              {TASK_STATUTS.map((s) => <option key={s} value={s}>{TASK_STATUS_LABELS[s]}</option>)}
            </select>
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button className="btn" type="submit">Enregistrer</button>
              <button type="button" className="btn secondary" onClick={onClose}>Annuler</button>
              <button type="button" className="btn danger" onClick={remove}>Supprimer</button>
            </div>
          </form>
        )}
      </div>
    </>
  );
}

export function EditPanel({ target, onClose, onSaved }: Props) {
  // Échap pour fermer
  useEffect(() => {
    if (!target) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [target, onClose]);

  if (!target) return null;

  return (
    <>
      <div className="panel-overlay" onClick={onClose} />
      <aside className="panel">
        {target.type === "epic" && (
          <EpicForm trigramme={target.trigramme} onClose={onClose} onSaved={onSaved} />
        )}
        {target.type === "project" && (
          <ProjectForm id={target.id} onClose={onClose} onSaved={onSaved} />
        )}
        {target.type === "task" && (
          <TaskForm id={target.id} onClose={onClose} onSaved={onSaved} />
        )}
      </aside>
    </>
  );
}
