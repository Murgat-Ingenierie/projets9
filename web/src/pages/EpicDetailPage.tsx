import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { epics, measures, milestones, projects, users } from "../api/endpoints";
import { ErrorBanner } from "../components/ErrorBanner";
import {
  EPIC_CATEGORY_LABELS,
  EPIC_STATUS_LABELS,
  PROJECT_STATUS_LABELS,
  fmtDate,
} from "../labels";
import type {
  Epic,
  EpicCategory,
  EpicStatus,
  Measure,
  Milestone,
  Project,
  ProjectStatus,
  User,
} from "../types";

const EPIC_STATUTS: EpicStatus[] = ["idee", "actif", "realise", "abandonne"];
const EPIC_CATEGORIES: EpicCategory[] = ["operationnel", "strategique", "long_terme"];
const PROJECT_STATUTS: ProjectStatus[] = ["prevu", "en_cours", "realise", "abandonne"];

export default function EpicDetailPage() {
  const { trigramme = "" } = useParams();
  const location = useLocation();
  const nav = useNavigate();
  const startInEditMode = location.pathname.endsWith("/edit");

  const [epic, setEpic] = useState<Epic | null>(null);
  const [projs, setProjs] = useState<Project[]>([]);
  const [jalons, setJalons] = useState<Milestone[]>([]);
  const [mes, setMes] = useState<Measure[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [err, setErr] = useState<unknown>(null);

  const [editingEpic, setEditingEpic] = useState(false);
  const [epicDraft, setEpicDraft] = useState<Partial<Epic>>({});

  const [editingProjectId, setEditingProjectId] = useState<number | null>(null);
  const [projectDraft, setProjectDraft] = useState<Partial<Project>>({});

  const userNameById = useMemo(() => {
    const m = new Map<number, string>();
    allUsers.forEach((u) => m.set(u.id, u.nom));
    return m;
  }, [allUsers]);

  function load() {
    Promise.all([
      epics.get(trigramme),
      projects.list(trigramme),
      milestones.list({ epic: trigramme }),
      measures.list(trigramme),
      users.list(),
    ])
      .then(([e, p, j, m, u]) => {
        setEpic(e);
        setProjs(p);
        setJalons(j);
        setMes(m);
        setAllUsers(u);
      })
      .catch(setErr);
  }
  useEffect(load, [trigramme]);

  // Démarre en mode édition si l'URL est /edit
  useEffect(() => {
    if (epic && startInEditMode && !editingEpic) {
      setEpicDraft({ ...epic });
      setEditingEpic(true);
    }
  }, [epic, startInEditMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Edit Epic ---
  function startEditEpic() {
    if (!epic) return;
    setEpicDraft({ ...epic });
    setEditingEpic(true);
    setErr(null);
  }
  function cancelEditEpic() {
    setEditingEpic(false);
    setEpicDraft({});
    if (startInEditMode) nav(`/epics/${trigramme}`, { replace: true });
  }
  async function saveEpic() {
    setErr(null);
    try {
      const updated = await epics.update(trigramme, epicDraft);
      setEpic(updated);
      setEditingEpic(false);
      setEpicDraft({});
      if (startInEditMode) nav(`/epics/${trigramme}`, { replace: true });
    } catch (e) {
      setErr(e);
    }
  }
  async function removeEpic() {
    if (!confirm(`Supprimer l'epic "${trigramme}" et tous ses projets ?`)) return;
    try {
      await epics.remove(trigramme);
      nav("/epics");
    } catch (e) {
      setErr(e);
    }
  }
  async function toggleCritereAtteint() {
    if (!epic) return;
    try {
      const updated = await epics.update(epic.trigramme, {
        critere_atteint: !epic.critere_atteint,
      });
      setEpic(updated);
    } catch (e) {
      setErr(e);
    }
  }

  // --- Edit Project (inline) ---
  function startEditProject(p: Project) {
    setEditingProjectId(p.id);
    setProjectDraft({ ...p });
    setErr(null);
  }
  function cancelEditProject() {
    setEditingProjectId(null);
    setProjectDraft({});
  }
  async function saveProject() {
    if (editingProjectId == null) return;
    setErr(null);
    try {
      await projects.update(editingProjectId, projectDraft);
      cancelEditProject();
      load();
    } catch (e) {
      setErr(e);
    }
  }
  async function removeProject(id: number) {
    if (!confirm("Supprimer ce projet ?")) return;
    try {
      await projects.remove(id);
      cancelEditProject();
      load();
    } catch (e) {
      setErr(e);
    }
  }

  if (!epic) return <p>Chargement…</p>;

  // Champs partagés entre lecture et édition — même ordre, mêmes libellés
  const fields: { label: string; render: () => React.ReactNode }[] = [
    {
      label: "Nom",
      render: () =>
        editingEpic ? (
          <input
            value={epicDraft.nom ?? ""}
            onChange={(e) => setEpicDraft({ ...epicDraft, nom: e.target.value })}
          />
        ) : (
          <span>{epic.nom}</span>
        ),
    },
    {
      label: "Critère de réussite",
      render: () =>
        editingEpic ? (
          <textarea
            rows={2}
            value={epicDraft.critere_reussite ?? ""}
            onChange={(e) => setEpicDraft({ ...epicDraft, critere_reussite: e.target.value })}
          />
        ) : (
          <span>{epic.critere_reussite || "—"}</span>
        ),
    },
    {
      label: "Raison de la date de fin",
      render: () =>
        editingEpic ? (
          <input
            value={epicDraft.raison_date_fin ?? ""}
            onChange={(e) => setEpicDraft({ ...epicDraft, raison_date_fin: e.target.value })}
          />
        ) : (
          <span>{epic.raison_date_fin || "—"}</span>
        ),
    },
    {
      label: "Date de fin prévue",
      render: () =>
        editingEpic ? (
          <input
            type="date"
            value={epicDraft.date_fin_prevue ?? ""}
            onChange={(e) =>
              setEpicDraft({ ...epicDraft, date_fin_prevue: e.target.value || null })
            }
          />
        ) : (
          <span>{fmtDate(epic.date_fin_prevue) || "—"}</span>
        ),
    },
    {
      label: "Jalon de fin maximum",
      render: () =>
        editingEpic ? (
          <input
            type="date"
            value={epicDraft.jalon_fin_max ?? ""}
            onChange={(e) =>
              setEpicDraft({ ...epicDraft, jalon_fin_max: e.target.value || null })
            }
          />
        ) : (
          <span>{fmtDate(epic.jalon_fin_max) || "—"}</span>
        ),
    },
    {
      label: "Statut",
      render: () =>
        editingEpic ? (
          <select
            value={epicDraft.statut ?? "idee"}
            onChange={(e) => setEpicDraft({ ...epicDraft, statut: e.target.value as EpicStatus })}
          >
            {EPIC_STATUTS.map((s) => (
              <option key={s} value={s}>{EPIC_STATUS_LABELS[s]}</option>
            ))}
          </select>
        ) : (
          <span className={`tag ${epic.statut}`}>{EPIC_STATUS_LABELS[epic.statut]}</span>
        ),
    },
    {
      label: "Catégorie",
      render: () =>
        editingEpic ? (
          <select
            value={epicDraft.categorie ?? "operationnel"}
            onChange={(e) =>
              setEpicDraft({ ...epicDraft, categorie: e.target.value as EpicCategory })
            }
          >
            {EPIC_CATEGORIES.map((c) => (
              <option key={c} value={c}>{EPIC_CATEGORY_LABELS[c]}</option>
            ))}
          </select>
        ) : (
          <span>{EPIC_CATEGORY_LABELS[epic.categorie]}</span>
        ),
    },
    {
      label: "Critère atteint",
      render: () =>
        editingEpic ? (
          <input
            type="checkbox"
            checked={!!epicDraft.critere_atteint}
            onChange={(e) => setEpicDraft({ ...epicDraft, critere_atteint: e.target.checked })}
          />
        ) : (
          <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <input type="checkbox" checked={epic.critere_atteint} onChange={toggleCritereAtteint} />
            <span>{epic.critere_atteint ? "Oui" : "Non"}</span>
          </label>
        ),
    },
  ];

  return (
    <>
      <div className="page-header">
        <h2>{epic.nom}</h2>
        {!editingEpic ? (
          <button className="btn" onClick={startEditEpic}>Éditer</button>
        ) : (
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn" onClick={saveEpic}>Enregistrer</button>
            <button className="btn secondary" onClick={cancelEditEpic}>Annuler</button>
            <button className="btn danger" onClick={removeEpic}>Supprimer</button>
          </div>
        )}
      </div>
      <ErrorBanner error={err} />

      <dl className="kv">
        {fields.map((f) => (
          <div key={f.label} className="kv-row">
            <dt>{f.label}</dt>
            <dd>{f.render()}</dd>
          </div>
        ))}
      </dl>

      <div className="page-header" style={{ marginTop: 32 }}>
        <h3 style={{ margin: 0 }}>Projets ({projs.length})</h3>
        <button
          className="btn"
          onClick={() => nav(`/projects/new?epic=${trigramme}`)}
        >
          + Ajouter un projet
        </button>
      </div>
      <table>
        <thead>
          <tr>
            <th>Nom</th>
            <th>Début</th>
            <th>Fin</th>
            <th>Responsable</th>
            <th>Statut</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {projs.map((p) =>
            editingProjectId === p.id ? (
              <tr key={p.id} className="editing">
                <td>
                  <input
                    value={projectDraft.nom ?? ""}
                    onChange={(ev) => setProjectDraft({ ...projectDraft, nom: ev.target.value })}
                  />
                </td>
                <td>
                  <input
                    type="date"
                    value={projectDraft.date_debut ?? ""}
                    onChange={(ev) => setProjectDraft({ ...projectDraft, date_debut: ev.target.value })}
                  />
                </td>
                <td>
                  <input
                    type="date"
                    value={projectDraft.date_fin ?? ""}
                    onChange={(ev) => setProjectDraft({ ...projectDraft, date_fin: ev.target.value })}
                  />
                </td>
                <td>
                  <select
                    value={projectDraft.responsable_id ?? ""}
                    onChange={(ev) =>
                      setProjectDraft({
                        ...projectDraft,
                        responsable_id: ev.target.value ? Number(ev.target.value) : null,
                      })
                    }
                  >
                    <option value="">—</option>
                    {allUsers.map((u) => <option key={u.id} value={u.id}>{u.nom}</option>)}
                  </select>
                </td>
                <td>
                  <select
                    value={projectDraft.statut ?? "prevu"}
                    onChange={(ev) =>
                      setProjectDraft({ ...projectDraft, statut: ev.target.value as ProjectStatus })
                    }
                  >
                    {PROJECT_STATUTS.map((s) => (
                      <option key={s} value={s}>{PROJECT_STATUS_LABELS[s]}</option>
                    ))}
                  </select>
                </td>
                <td className="row-actions">
                  <button className="btn" onClick={saveProject}>Enregistrer</button>
                  <button className="btn secondary" onClick={cancelEditProject}>Annuler</button>
                  <button className="btn danger" onClick={() => removeProject(p.id)}>Supprimer</button>
                </td>
              </tr>
            ) : (
              <tr key={p.id}>
                <td>{p.nom}</td>
                <td>{fmtDate(p.date_debut)}</td>
                <td>{fmtDate(p.date_fin)}</td>
                <td>{p.responsable_id ? userNameById.get(p.responsable_id) ?? "—" : "—"}</td>
                <td><span className={`tag ${p.statut}`}>{PROJECT_STATUS_LABELS[p.statut]}</span></td>
                <td>
                  <button className="btn secondary" onClick={() => startEditProject(p)}>Éditer</button>
                </td>
              </tr>
            )
          )}
        </tbody>
      </table>

      <div className="page-header" style={{ marginTop: 32 }}>
        <h3 style={{ margin: 0 }}>Jalons ({jalons.length})</h3>
        <button className="btn" onClick={() => nav("/milestones/new")}>+ Ajouter un jalon</button>
      </div>
      <table>
        <thead>
          <tr><th>Nom</th><th>Date</th><th>Atteint</th></tr>
        </thead>
        <tbody>
          {jalons.map((j) => (
            <tr key={j.id}>
              <td>{j.nom}</td>
              <td>{fmtDate(j.date)}</td>
              <td>{j.atteint ? "Oui" : "Non"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3 style={{ marginTop: 32 }}>Mesures ({mes.length})</h3>
      <table>
        <thead>
          <tr><th>Date</th><th>Valeur</th><th>Unité</th><th>Commentaire</th></tr>
        </thead>
        <tbody>
          {mes.map((m) => (
            <tr key={m.id}>
              <td>{fmtDate(m.date)}</td>
              <td>{m.valeur}</td>
              <td>{m.unite}</td>
              <td>{m.commentaire}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
