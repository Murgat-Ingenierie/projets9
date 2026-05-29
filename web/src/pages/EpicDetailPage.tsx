import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { epics, measures, milestones, projects, users } from "../api/endpoints";
import { Breadcrumb, type Crumb } from "../components/Breadcrumb";
import { EpicEditor } from "../components/EpicEditor";
import { ErrorBanner } from "../components/ErrorBanner";
import { EpicSelect, UserSelect } from "../components/selects";
import { navState, useParentCrumbs } from "../hooks/useBreadcrumbState";
import {
  EPIC_CATEGORY_LABELS,
  EPIC_STATUS_LABELS,
  PROJECT_STATUS_LABELS,
  PROJECT_STATUTS,
  fmtDate,
} from "../labels";
import type {
  Epic,
  Measure,
  Milestone,
  Project,
  ProjectStatus,
  User,
} from "../types";

const DEFAULT_PARENT: Crumb[] = [
  { label: "Planning", to: "/" },
  { label: "Epics", to: "/epics" },
];

export default function EpicDetailPage() {
  const { trigramme = "" } = useParams();
  const location = useLocation();
  const nav = useNavigate();
  const parentCrumbs = useParentCrumbs(DEFAULT_PARENT);
  const startInEditMode = location.pathname.endsWith("/edit");

  const [epic, setEpic] = useState<Epic | null>(null);
  const [projs, setProjs] = useState<Project[]>([]);
  const [jalons, setJalons] = useState<Milestone[]>([]);
  const [mes, setMes] = useState<Measure[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [allEpics, setAllEpics] = useState<Epic[]>([]);
  const [err, setErr] = useState<unknown>(null);

  const [editingEpic, setEditingEpic] = useState(false);

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
      epics.list(),
    ])
      .then(([e, p, j, m, u, allE]) => {
        setEpic(e);
        setProjs(p);
        setJalons(j);
        setMes(m);
        setAllUsers(u);
        setAllEpics(allE);
      })
      .catch(setErr);
  }
  useEffect(load, [trigramme]);

  useEffect(() => {
    if (epic && startInEditMode && !editingEpic) setEditingEpic(true);
  }, [epic, startInEditMode]); // eslint-disable-line react-hooks/exhaustive-deps

  function cancelEditEpic() {
    setEditingEpic(false);
    if (startInEditMode) nav(`/epics/${trigramme}`, { replace: true });
  }
  function onEpicSaved() {
    setEditingEpic(false);
    if (startInEditMode) nav(`/epics/${trigramme}`, { replace: true });
    load();
  }
  function onEpicDeleted() {
    nav("/epics");
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

  const readonlyFields: { label: string; render: () => React.ReactNode }[] = [
    { label: "Nom", render: () => <span>{epic.nom}</span> },
    { label: "Critère de réussite", render: () => <span>{epic.critere_reussite || "—"}</span> },
    { label: "Raison de la date de fin", render: () => <span>{epic.raison_date_fin || "—"}</span> },
    { label: "Date de fin prévue", render: () => <span>{fmtDate(epic.date_fin_prevue) || "—"}</span> },
    { label: "Jalon de fin maximum", render: () => <span>{fmtDate(epic.jalon_fin_max) || "—"}</span> },
    {
      label: "Statut",
      render: () => <span className={`tag ${epic.statut}`}>{EPIC_STATUS_LABELS[epic.statut]}</span>,
    },
    { label: "Catégorie", render: () => <span>{EPIC_CATEGORY_LABELS[epic.categorie]}</span> },
    {
      label: "Couleur",
      render: () => (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              display: "inline-block",
              width: 20,
              height: 20,
              background: epic.couleur ?? "#3f51b5",
              borderRadius: 4,
              border: "1px solid #e0e0e0",
            }}
          />
          <code style={{ color: "#5f6368", fontSize: 12 }}>{epic.couleur ?? "(défaut)"}</code>
        </div>
      ),
    },
  ];

  return (
    <>
      <Breadcrumb items={[...parentCrumbs, { label: epic.nom }]} />
      <div className="page-header">
        <h2>{epic.nom}</h2>
        {!editingEpic && (
          <button className="btn" onClick={() => setEditingEpic(true)}>Éditer</button>
        )}
      </div>
      <ErrorBanner error={err} />

      {editingEpic ? (
        <EpicEditor
          trigramme={trigramme}
          onSaved={onEpicSaved}
          onCancel={cancelEditEpic}
          onDeleted={onEpicDeleted}
          showDelete
        />
      ) : (
        <dl className="kv">
          {readonlyFields.map((f) => (
            <div key={f.label} className="kv-row">
              <dt>{f.label}</dt>
              <dd>{f.render()}</dd>
            </div>
          ))}
        </dl>
      )}

      <div className="page-header" style={{ marginTop: 32 }}>
        <h3 style={{ margin: 0 }}>Projets ({projs.length})</h3>
        <button
          className="btn"
          onClick={() =>
            nav(
              `/projects/new?epic=${trigramme}`,
              navState(parentCrumbs, { label: epic.nom, to: `/epics/${trigramme}` })
            )
          }
        >
          + Ajouter un projet
        </button>
      </div>
      <table>
        <thead>
          <tr>
            <th>Nom</th>
            <th>Epic</th>
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
                  <EpicSelect
                    value={projectDraft.epic_trigramme ?? ""}
                    onChange={(t) => setProjectDraft({ ...projectDraft, epic_trigramme: t })}
                    epics={allEpics}
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
                  <UserSelect
                    value={projectDraft.responsable_id ?? null}
                    onChange={(id) => setProjectDraft({ ...projectDraft, responsable_id: id })}
                    users={allUsers}
                  />
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
                <td>{epic.nom}</td>
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
        <button
          className="btn"
          onClick={() =>
            nav(
              "/milestones/new",
              navState(parentCrumbs, { label: epic.nom, to: `/epics/${trigramme}` })
            )
          }
        >
          + Ajouter un jalon
        </button>
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
