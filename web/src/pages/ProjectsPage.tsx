import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { epics, projects, users } from "../api/endpoints";
import { Breadcrumb, type Crumb } from "../components/Breadcrumb";
import { ErrorBanner } from "../components/ErrorBanner";
import { useSortableList } from "../hooks/useSort";
import { navState } from "../hooks/useBreadcrumbState";
import { PROJECT_STATUS_LABELS, PROJECT_STATUTS, fmtDate } from "../labels";
import { EpicSelect, UserSelect } from "../components/selects";
import { BoutonSupprimer } from "../components/BoutonSupprimer";
import { useInlineEdit } from "../hooks/useInlineEdit";
import type { Epic, Project } from "../types";

const PARENT: Crumb[] = [{ label: "Planning", to: "/" }];
const SELF: Crumb = { label: "Projets", to: "/projects" };

export default function ProjectsPage() {
  const nav = useNavigate();
  const [items, setItems] = useState<Project[]>([]);
  const [allEpics, setAllEpics] = useState<Epic[]>([]);
  const [allUsers, setAllUsers] = useState<{ id: number; nom: string }[]>([]);
  const [err, setErr] = useState<unknown>(null);

  function load() {
    Promise.all([projects.list(), epics.list(), users.annuaire()])
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
  const userNameById = useMemo(() => {
    const m = new Map<number, string>();
    allUsers.forEach((u) => m.set(u.id, u.nom));
    return m;
  }, [allUsers]);

  const { editingId: editing, draft: editDraft, start, cancel, patch, isEditing } =
    useInlineEdit<Project>();

  function startEdit(p: Project) {
    start(p);
    setErr(null);
  }
  async function saveEdit() {
    if (editing == null) return;
    setErr(null);
    try {
      // Les champs ÉDITÉS ici, pas le brouillon entier. Le brouillon est une
      // copie de la ligne : il porte `description`, que cette table n'affiche
      // pas. L'envoyer la transmettrait à `null`, et la route — qui applique
      // tout champ FOURNI (`exclude_unset`) — effacerait une description que
      // seule la page de détail montre. Perte invisible depuis cet écran.
      await projects.update(editing, {
        epic_trigramme: editDraft.epic_trigramme,
        nom: editDraft.nom,
        date_debut: editDraft.date_debut,
        date_fin: editDraft.date_fin,
        responsable_id: editDraft.responsable_id,
        statut: editDraft.statut,
      });
      cancel();
      load();
    } catch (e) {
      setErr(e);
    }
  }
  async function removeRow(id: number) {
    if (!confirm("Supprimer ce projet ? Ses tâches seront supprimées avec lui.")) return;
    setErr(null);
    try {
      await projects.remove(id);
      cancel();
      load();
    } catch (e) {
      setErr(e);
    }
  }

  const { sorted, sortHeader, filteredCount, totalCount } = useSortableList(items);

  return (
    <>
      <Breadcrumb items={[...PARENT, { label: SELF.label }]} />
      <div className="page-header">
        <h2>Projets</h2>
        <button className="btn" onClick={() => nav("/projects/new", navState(PARENT, SELF))}>+ Ajouter</button>
      </div>
      <ErrorBanner error={err} />
      <p className="muted">{filteredCount} sur {totalCount}</p>

      <table>
        <thead>
          <tr>
            {sortHeader("Epic", "epic", (p: Project) => epicNameByTri.get(p.epic_trigramme) ?? p.epic_trigramme)}
            {sortHeader("Nom", "nom", (p: Project) => p.nom)}
            {sortHeader("Début", "debut", (p: Project) => p.date_debut)}
            {sortHeader("Fin", "fin", (p: Project) => p.date_fin)}
            {sortHeader("Responsable", "responsable", (p: Project) => p.responsable_id ? userNameById.get(p.responsable_id) ?? "" : "")}
            {sortHeader("Statut", "statut", (p: Project) => PROJECT_STATUS_LABELS[p.statut])}
            <th></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((p) =>
            isEditing(p.id) ? (
              <tr key={p.id} className="editing">
                <td>
                  <EpicSelect
                    value={editDraft.epic_trigramme ?? ""}
                    onChange={(tri) => patch({ epic_trigramme: tri })}
                    epics={allEpics}
                    required
                  />
                </td>
                <td>
                  <input
                    value={editDraft.nom ?? ""}
                    onChange={(ev) => patch({ nom: ev.target.value })}
                  />
                </td>
                <td>
                  <input
                    type="date"
                    value={editDraft.date_debut ?? ""}
                    onChange={(ev) => patch({ date_debut: ev.target.value })}
                  />
                </td>
                <td>
                  <input
                    type="date"
                    value={editDraft.date_fin ?? ""}
                    onChange={(ev) => patch({ date_fin: ev.target.value })}
                  />
                </td>
                <td>
                  <UserSelect
                    value={editDraft.responsable_id ?? null}
                    onChange={(id) => patch({ responsable_id: id })}
                    users={allUsers}
                  />
                </td>
                <td>
                  <select
                    value={editDraft.statut ?? "prevu"}
                    onChange={(ev) => patch({ statut: ev.target.value as Project["statut"] })}
                  >
                    {PROJECT_STATUTS.map((st) => (
                      <option key={st} value={st}>{PROJECT_STATUS_LABELS[st]}</option>
                    ))}
                  </select>
                </td>
                <td className="row-actions">
                  <button className="btn" onClick={saveEdit}>Enregistrer</button>
                  <button className="btn secondary" onClick={cancel}>Annuler</button>
                  <BoutonSupprimer onClick={() => removeRow(p.id)} />
                </td>
              </tr>
            ) : (
              <tr key={p.id}>
                <td>{epicNameByTri.get(p.epic_trigramme) ?? p.epic_trigramme}</td>
                <td>{p.nom}</td>
                <td>{fmtDate(p.date_debut)}</td>
                <td>{fmtDate(p.date_fin)}</td>
                <td>{p.responsable_id ? userNameById.get(p.responsable_id) ?? "—" : "—"}</td>
                <td><span className={`tag ${p.statut}`}>{PROJECT_STATUS_LABELS[p.statut]}</span></td>
                <td className="row-actions">
                  <button className="btn secondary" onClick={() => startEdit(p)}>Éditer</button>
                  {/* « Ouvrir » reste : la page de détail porte la description et
                      les tâches du projet, que la ligne ne peut pas montrer. */}
                  <button
                    className="btn secondary"
                    onClick={() => nav(`/projects/${p.id}/edit`, navState(PARENT, SELF))}
                  >
                    Ouvrir
                  </button>
                </td>
              </tr>
            ),
          )}
        </tbody>
      </table>
    </>
  );
}
