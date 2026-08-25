import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { milestones, projects } from "../api/endpoints";
import { Breadcrumb, type Crumb } from "../components/Breadcrumb";
import { ErrorBanner } from "../components/ErrorBanner";
import { useSortableList } from "../hooks/useSort";
import { navState } from "../hooks/useBreadcrumbState";
import { fmtDate } from "../labels";
import type { Milestone, Project } from "../types";
import { BoutonSupprimer } from "../components/BoutonSupprimer";

const PARENT: Crumb[] = [{ label: "Planning", to: "/" }];
const SELF: Crumb = { label: "Jalons", to: "/milestones" };

export default function MilestonesPage() {
  const nav = useNavigate();
  const [items, setItems] = useState<Milestone[]>([]);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [err, setErr] = useState<unknown>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<Milestone>>({});

  function load() {
    Promise.all([milestones.list(), projects.list()])
      .then(([m, p]) => {
        setItems(m);
        setAllProjects(p);
      })
      .catch(setErr);
  }
  useEffect(load, []);

  const projectName = useMemo(() => {
    const m = new Map<number, string>();
    allProjects.forEach((p) => m.set(p.id, p.nom));
    return m;
  }, [allProjects]);

  const projectsLabel = (m: Milestone) =>
    (m.project_ids ?? [])
      .map((id) => projectName.get(id) ?? `#${id}`)
      .join(", ");

  const { sorted, sortHeader, filteredCount, totalCount, recherche, setRecherche } =
    useSortableList(items);
  const [ouvertes, setOuvertes] = useState<Set<number>>(new Set());
  const basculer = (id: number) =>
    setOuvertes((s) => {
      const n = new Set(s);
      if (!n.delete(id)) n.add(id);
      return n;
    });

  function startEdit(m: Milestone) {
    setEditing(m.id);
    setEditDraft({ ...m });
    setErr(null);
  }
  function cancelEdit() {
    setEditing(null);
    setEditDraft({});
  }
  async function saveEdit() {
    if (editing == null) return;
    setErr(null);
    try {
      await milestones.update(editing, {
        nom: editDraft.nom,
        date: editDraft.date,
        atteint: editDraft.atteint,
      });
      cancelEdit();
      load();
    } catch (e) {
      setErr(e);
    }
  }
  async function removeRow(id: number) {
    if (!confirm("Supprimer ce jalon ?")) return;
    try {
      await milestones.remove(id);
      cancelEdit();
      load();
    } catch (e) {
      setErr(e);
    }
  }

  return (
    <>
      <Breadcrumb items={[...PARENT, { label: SELF.label }]} />
      <div className="page-header">
        <h2>Jalons</h2>
        <button className="btn" onClick={() => nav("/milestones/new", navState(PARENT, SELF))}>+ Ajouter</button>
      </div>
      <ErrorBanner error={err} />
      {/* Les filtres par colonne vivent dans l'en-tête, masqué sur écran étroit :
          la recherche libre est alors le seul moyen de filtrer. */}
      <div className="barre-recherche">
        <input
          type="search"
          placeholder="Rechercher un jalon…"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          aria-label="Rechercher un jalon"
        />
        <span className="muted">{filteredCount} sur {totalCount}</span>
      </div>

      <table className="responsive repliable">
        <thead>
          <tr>
            {sortHeader("Projets", "projets", projectsLabel)}
            {sortHeader("Nom", "nom", (m: Milestone) => m.nom)}
            {sortHeader("Date", "date", (m: Milestone) => m.date)}
            {sortHeader("Atteint", "atteint", (m: Milestone) => m.atteint ? 1 : 0)}
            <th></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((m) =>
            editing === m.id ? (
              <tr key={m.id} className="editing">
                <td data-label="Projets">{projectsLabel(m)}</td>
                <td data-label="Nom">
                  <input
                    value={editDraft.nom ?? ""}
                    onChange={(ev) => setEditDraft({ ...editDraft, nom: ev.target.value })}
                  />
                </td>
                <td data-label="Date">
                  <input
                    type="date"
                    value={editDraft.date ?? ""}
                    onChange={(ev) => setEditDraft({ ...editDraft, date: ev.target.value })}
                  />
                </td>
                <td data-label="Atteint">
                  <input
                    type="checkbox"
                    checked={!!editDraft.atteint}
                    onChange={(ev) => setEditDraft({ ...editDraft, atteint: ev.target.checked })}
                  />
                </td>
                <td className="row-actions">
                  <button className="btn" onClick={saveEdit}>Enregistrer</button>
                  <button className="btn secondary" onClick={cancelEdit}>Annuler</button>
                  <BoutonSupprimer onClick={() => removeRow(m.id)}>Supprimer</BoutonSupprimer>
                </td>
              </tr>
            ) : (
              <tr key={m.id} className={ouvertes.has(m.id) ? "carte-ouverte" : ""}>
                <td data-label="Projets">{projectsLabel(m)}</td>
                <td data-label="Nom" className="carte-titre">
                  {m.nom}
                  <button
                    type="button"
                    className="carte-bascule"
                    onClick={() => basculer(m.id)}
                    aria-expanded={ouvertes.has(m.id)}
                    aria-label={ouvertes.has(m.id) ? `Replier ${m.nom}` : `Déplier ${m.nom}`}
                  >
                    <span className="material-symbols-outlined">
                      {ouvertes.has(m.id) ? "expand_less" : "expand_more"}
                    </span>
                  </button>
                </td>
                <td data-label="Date">{fmtDate(m.date)}</td>
                <td data-label="Atteint">{m.atteint ? "Oui" : "Non"}</td>
                <td className="row-actions"><button className="btn secondary" onClick={() => startEdit(m)}>Éditer</button></td>
              </tr>
            )
          )}
        </tbody>
      </table>
    </>
  );
}
