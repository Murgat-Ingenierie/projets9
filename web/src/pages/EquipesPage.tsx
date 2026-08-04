import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { equipes as equipesApi } from "../api/endpoints";
import { Breadcrumb, type Crumb } from "../components/Breadcrumb";
import { ErrorBanner } from "../components/ErrorBanner";
import { useInlineEdit } from "../hooks/useInlineEdit";
import { useSortableList } from "../hooks/useSort";
import { navState } from "../hooks/useBreadcrumbState";
import type { Equipe } from "../types";
import { BoutonSupprimer } from "../components/BoutonSupprimer";

const PARENT: Crumb[] = [{ label: "Planning", to: "/" }];
const SELF: Crumb = { label: "Équipes", to: "/equipes" };

export default function EquipesPage() {
  const nav = useNavigate();
  const [items, setItems] = useState<Equipe[]>([]);
  const [err, setErr] = useState<unknown>(null);
  const { editingId: editing, draft: editDraft, start, cancel, patch, isEditing } =
    useInlineEdit<Equipe>();

  function load() {
    equipesApi.list().then(setItems).catch(setErr);
  }
  useEffect(load, []);

  const { sorted, sortHeader, filteredCount, totalCount } = useSortableList(items);

  function startEdit(e: Equipe) {
    start(e);
    setErr(null);
  }
  async function saveEdit() {
    if (editing == null) return;
    setErr(null);
    try {
      await equipesApi.update(editing, {
        nom: editDraft.nom,
        temps_dispo_hebdo: editDraft.temps_dispo_hebdo,
      });
      cancel();
      load();
    } catch (e) {
      setErr(e);
    }
  }
  async function removeRow(id: number) {
    if (!confirm("Supprimer cette équipe ? Les allocations sur les tâches seront perdues.")) return;
    try {
      await equipesApi.remove(id);
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
        <h2>Équipes</h2>
        <button className="btn" onClick={() => nav("/equipes/new", navState(PARENT, SELF))}>+ Ajouter</button>
      </div>
      <ErrorBanner error={err} />
      <p className="muted">{filteredCount} sur {totalCount}</p>

      <table>
        <thead>
          <tr>
            {sortHeader("Nom", "nom", (e: Equipe) => e.nom)}
            {sortHeader("Temps dispo / sem (h)", "temps", (e: Equipe) => e.temps_dispo_hebdo, { noFilter: true })}
            <th></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((e) =>
            isEditing(e.id) ? (
              <tr key={e.id} className="editing">
                <td>
                  <input
                    value={editDraft.nom ?? ""}
                    onChange={(ev) => patch({ nom: ev.target.value })}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    value={editDraft.temps_dispo_hebdo ?? 0}
                    onChange={(ev) => patch({ temps_dispo_hebdo: parseFloat(ev.target.value) })}
                    style={{ width: 100 }}
                  />
                </td>
                <td className="row-actions">
                  <button className="btn" onClick={saveEdit}>Enregistrer</button>
                  <button className="btn secondary" onClick={cancel}>Annuler</button>
                  <BoutonSupprimer onClick={() => removeRow(e.id)}>Supprimer</BoutonSupprimer>
                </td>
              </tr>
            ) : (
              <tr key={e.id}>
                <td>{e.nom}</td>
                <td>{e.temps_dispo_hebdo} h</td>
                <td><button className="btn secondary" onClick={() => startEdit(e)}>Éditer</button></td>
              </tr>
            )
          )}
        </tbody>
      </table>
    </>
  );
}
