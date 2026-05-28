import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { epics, projects, users } from "../api/endpoints";
import { Breadcrumb, type Crumb } from "../components/Breadcrumb";
import { ErrorBanner } from "../components/ErrorBanner";
import { useSortableList } from "../hooks/useSort";
import { navState } from "../hooks/useBreadcrumbState";
import { PROJECT_STATUS_LABELS, fmtDate } from "../labels";
import type { Epic, Project, User } from "../types";

const PARENT: Crumb[] = [{ label: "Planning", to: "/" }];
const SELF: Crumb = { label: "Projets", to: "/projects" };

export default function ProjectsPage() {
  const nav = useNavigate();
  const [items, setItems] = useState<Project[]>([]);
  const [allEpics, setAllEpics] = useState<Epic[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [err, setErr] = useState<unknown>(null);

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
  const userNameById = useMemo(() => {
    const m = new Map<number, string>();
    allUsers.forEach((u) => m.set(u.id, u.nom));
    return m;
  }, [allUsers]);

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
          {sorted.map((p) => (
            <tr key={p.id}>
              <td>{epicNameByTri.get(p.epic_trigramme) ?? p.epic_trigramme}</td>
              <td>{p.nom}</td>
              <td>{fmtDate(p.date_debut)}</td>
              <td>{fmtDate(p.date_fin)}</td>
              <td>{p.responsable_id ? userNameById.get(p.responsable_id) ?? "—" : "—"}</td>
              <td><span className={`tag ${p.statut}`}>{PROJECT_STATUS_LABELS[p.statut]}</span></td>
              <td>
                <button
                  className="btn secondary"
                  onClick={() => nav(`/projects/${p.id}/edit`, navState(PARENT, SELF))}
                >
                  Ouvrir
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
