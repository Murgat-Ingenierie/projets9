import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { epics, milestones } from "../api/endpoints";
import { Breadcrumb, type Crumb } from "../components/Breadcrumb";
import { ErrorBanner } from "../components/ErrorBanner";
import { useSortableList } from "../hooks/useSort";
import { navState } from "../hooks/useBreadcrumbState";
import { fmtDate } from "../labels";
import type { Epic, Milestone } from "../types";

const PARENT: Crumb[] = [{ label: "Planning", to: "/" }];
const SELF: Crumb = { label: "Jalons", to: "/milestones" };

export default function MilestonesPage() {
  const nav = useNavigate();
  const [items, setItems] = useState<Milestone[]>([]);
  const [allEpics, setAllEpics] = useState<Epic[]>([]);
  const [err, setErr] = useState<unknown>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<Milestone>>({});

  function load() {
    Promise.all([milestones.list(), epics.list()])
      .then(([m, e]) => {
        setItems(m);
        setAllEpics(e);
      })
      .catch(setErr);
  }
  useEffect(load, []);

  const epicName = useMemo(() => {
    const m = new Map<string, string>();
    allEpics.forEach((e) => m.set(e.trigramme, e.nom));
    return m;
  }, [allEpics]);

  const epicsLabel = (m: Milestone) =>
    (m.epic_trigrammes ?? [])
      .map((t) => epicName.get(t) ?? t)
      .join(", ");

  const { sorted, sortHeader, filteredCount, totalCount } = useSortableList(items);

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
      <p className="muted">{filteredCount} sur {totalCount}</p>

      <table>
        <thead>
          <tr>
            {sortHeader("Epics", "epics", epicsLabel)}
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
                <td>{epicsLabel(m)}</td>
                <td>
                  <input
                    value={editDraft.nom ?? ""}
                    onChange={(ev) => setEditDraft({ ...editDraft, nom: ev.target.value })}
                  />
                </td>
                <td>
                  <input
                    type="date"
                    value={editDraft.date ?? ""}
                    onChange={(ev) => setEditDraft({ ...editDraft, date: ev.target.value })}
                  />
                </td>
                <td>
                  <input
                    type="checkbox"
                    checked={!!editDraft.atteint}
                    onChange={(ev) => setEditDraft({ ...editDraft, atteint: ev.target.checked })}
                  />
                </td>
                <td className="row-actions">
                  <button className="btn" onClick={saveEdit}>Enregistrer</button>
                  <button className="btn secondary" onClick={cancelEdit}>Annuler</button>
                  <button className="btn danger" onClick={() => removeRow(m.id)}>Supprimer</button>
                </td>
              </tr>
            ) : (
              <tr key={m.id}>
                <td>{epicsLabel(m)}</td>
                <td>{m.nom}</td>
                <td>{fmtDate(m.date)}</td>
                <td>{m.atteint ? "Oui" : "Non"}</td>
                <td><button className="btn secondary" onClick={() => startEdit(m)}>Éditer</button></td>
              </tr>
            )
          )}
        </tbody>
      </table>
    </>
  );
}
