import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { projects, tasks, users } from "../api/endpoints";
import { Breadcrumb, type Crumb } from "../components/Breadcrumb";
import { ErrorBanner } from "../components/ErrorBanner";
import { ProjectSelect, UserSelect } from "../components/selects";
import { Switch } from "../components/Switch";
import { useInlineEdit } from "../hooks/useInlineEdit";
import { useSortableList } from "../hooks/useSort";
import { navState } from "../hooks/useBreadcrumbState";
import { fmtDate } from "../labels";
import type { Project, Task } from "../types";
import { BoutonSupprimer } from "../components/BoutonSupprimer";

const PARENT: Crumb[] = [{ label: "Planning", to: "/" }];
const SELF: Crumb = { label: "Tâches", to: "/tasks" };

export default function TasksPage() {
  const nav = useNavigate();
  const [items, setItems] = useState<Task[]>([]);
  const [projs, setProjs] = useState<Project[]>([]);
  const [allUsers, setAllUsers] = useState<{ id: number; nom: string }[]>([]);
  const [err, setErr] = useState<unknown>(null);
  const { editingId: editing, draft: editDraft, start, cancel, patch, isEditing } = useInlineEdit<Task>();

  function load() {
    Promise.all([tasks.list(), projects.list(), users.annuaire()])
      .then(([t, p, u]) => {
        setItems(t);
        setProjs(p);
        setAllUsers(u);
      })
      .catch(setErr);
  }
  useEffect(load, []);

  const projNameById = useMemo(() => {
    const m = new Map<number, string>();
    projs.forEach((p) => m.set(p.id, p.nom));
    return m;
  }, [projs]);
  const userNameById = useMemo(() => {
    const m = new Map<number, string>();
    allUsers.forEach((u) => m.set(u.id, u.nom));
    return m;
  }, [allUsers]);

  const { sorted, sortHeader, filteredCount, totalCount, recherche, setRecherche } =
    useSortableList(items);
  // Cartes DÉPLIÉES sur écran étroit : identifiants des lignes ouvertes.
  // Sans effet au-delà du seuil, où la table reste une table — la classe
  // posée plus bas n'y est lue par aucune règle.
  const [ouvertes, setOuvertes] = useState<Set<number>>(new Set());
  const basculer = (id: number) =>
    setOuvertes((s) => {
      const n = new Set(s);
      if (!n.delete(id)) n.add(id);
      return n;
    });

  function startEdit(t: Task) {
    start(t);
    setErr(null);
  }
  async function saveEdit() {
    if (editing == null) return;
    setErr(null);
    try {
      await tasks.update(editing, editDraft);
      cancel();
      load();
    } catch (e) {
      setErr(e);
    }
  }
  async function removeRow(id: number) {
    if (!confirm("Supprimer cette tâche ?")) return;
    try {
      await tasks.remove(id);
      cancel();
      load();
    } catch (e) {
      setErr(e);
    }
  }

  return (
    <>
      <Breadcrumb items={[...PARENT, { label: SELF.label }]} />
      <div className="page-header">
        <h2>Tâches</h2>
        <button className="btn" onClick={() => nav("/tasks/new", navState(PARENT, SELF))}>+ Ajouter</button>
      </div>
      <ErrorBanner error={err} />
      <div className="barre-recherche">
        <input
          type="search"
          placeholder="Rechercher une tâche…"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          aria-label="Rechercher une tâche"
        />
        <span className="muted">{filteredCount} sur {totalCount}</span>
      </div>

      <table className="responsive">
        <thead>
          <tr>
            {sortHeader("Projet", "projet", (t: Task) => projNameById.get(t.projet_id) ?? "")}
            {sortHeader("Nom", "nom", (t: Task) => t.nom)}
            {sortHeader("Début", "debut", (t: Task) => t.date_debut)}
            {sortHeader("Fin", "fin", (t: Task) => t.date_fin)}
            {sortHeader("Responsable", "resp", (t: Task) => t.responsable_id ? userNameById.get(t.responsable_id) ?? "" : "")}
            {sortHeader("Fini", "fini", (t: Task) => t.statut === "archive" ? 1 : 0)}
            <th></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((t) =>
            isEditing(t.id) ? (
              <tr key={t.id} className="editing">
                <td data-label="Projet">
                  <ProjectSelect
                    value={editDraft.projet_id ?? null}
                    onChange={(id) => patch({projet_id: id ?? undefined })}
                    projects={projs}
                    required
                  />
                </td>
                <td data-label="Nom">
                  <input
                    value={editDraft.nom ?? ""}
                    onChange={(ev) => patch({nom: ev.target.value })}
                  />
                </td>
                <td data-label="Début">
                  <input
                    type="date"
                    value={editDraft.date_debut ?? ""}
                    onChange={(ev) => patch({date_debut: ev.target.value })}
                  />
                </td>
                <td data-label="Fin">
                  <input
                    type="date"
                    value={editDraft.date_fin ?? ""}
                    onChange={(ev) => patch({date_fin: ev.target.value })}
                  />
                </td>
                <td data-label="Responsable">
                  <UserSelect
                    value={editDraft.responsable_id ?? null}
                    onChange={(id) => patch({responsable_id: id })}
                    users={allUsers}
                  />
                </td>
                <td data-label="Fini">
                  <Switch
                    checked={editDraft.statut === "archive"}
                    onChange={(c) => patch({ statut: c ? "archive" : "ouvert" })}
                  />
                </td>
                <td className="row-actions">
                  <button className="btn" onClick={saveEdit}>Enregistrer</button>
                  <button className="btn secondary" onClick={cancel}>Annuler</button>
                  <BoutonSupprimer onClick={() => removeRow(t.id)}>Supprimer</BoutonSupprimer>
                </td>
              </tr>
            ) : (
              <tr key={t.id} className={ouvertes.has(t.id) ? "carte-ouverte" : ""}>
                <td data-label="Projet">{projNameById.get(t.projet_id) ?? t.projet_id}</td>
                <td data-label="Nom" className="carte-titre">
                  {t.nom}
                  {/* Replier une carte n'a de sens que sur écran étroit : ce bouton
                      est masqué au-delà du seuil, où la table reste une table. */}
                  <button
                    type="button"
                    className="carte-bascule"
                    onClick={() => basculer(t.id)}
                    aria-expanded={ouvertes.has(t.id)}
                    aria-label={ouvertes.has(t.id) ? `Replier ${t.nom}` : `Déplier ${t.nom}`}
                  >
                    <span className="material-symbols-outlined">
                      {ouvertes.has(t.id) ? "expand_less" : "expand_more"}
                    </span>
                  </button>
                </td>
                <td data-label="Début">{fmtDate(t.date_debut)}</td>
                <td data-label="Fin">{fmtDate(t.date_fin)}</td>
                <td data-label="Responsable">{t.responsable_id ? userNameById.get(t.responsable_id) ?? "—" : "—"}</td>
                <td data-label="Fini">
                  {t.statut === "archive" ? (
                    <span className="material-symbols-outlined" style={{ fontSize: 18, color: "#2e7d32" }}>check_circle</span>
                  ) : (
                    <span style={{ color: "#bdbdbd" }}>—</span>
                  )}
                </td>
                <td className="row-actions">
                  <button className="btn secondary" onClick={() => startEdit(t)}>Éditer</button>
                  <button
                    className="btn secondary"
                    onClick={() => nav(`/tasks/${t.id}/edit`, navState(PARENT, SELF))}
                  >
                    Ouvrir
                  </button>
                </td>
              </tr>
            )
          )}
        </tbody>
      </table>
    </>
  );
}
