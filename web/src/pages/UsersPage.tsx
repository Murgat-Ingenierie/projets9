import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { users as usersApi } from "../api/endpoints";
import { Breadcrumb, type Crumb } from "../components/Breadcrumb";
import { ErrorBanner } from "../components/ErrorBanner";
import { useInlineEdit } from "../hooks/useInlineEdit";
import { useSortableList } from "../hooks/useSort";
import { navState } from "../hooks/useBreadcrumbState";
import { USER_ROLE_LABELS, USER_ROLES } from "../labels";
import type { User, UserRole } from "../types";
import { BoutonSupprimer } from "../components/BoutonSupprimer";

const PARENT: Crumb[] = [{ label: "Planning", to: "/" }];
const SELF: Crumb = { label: "Utilisateurs", to: "/users" };

export default function UsersPage() {
  const nav = useNavigate();
  const [items, setItems] = useState<User[]>([]);
  const [err, setErr] = useState<unknown>(null);
  const { editingId: editing, draft: editDraft, start, cancel, patch, isEditing } =
    useInlineEdit<User>();

  function load() {
    usersApi.list().then(setItems).catch(setErr);
  }
  useEffect(load, []);

  const { sorted, sortHeader, filteredCount, totalCount } = useSortableList(items);

  function startEdit(u: User) {
    start(u);
    setErr(null);
  }
  async function saveEdit() {
    if (editing == null) return;
    setErr(null);
    const payload = {
      nom: editDraft.nom,
      email: editDraft.email,
      role: editDraft.role,
      actif: editDraft.actif,
    };
    try {
      await usersApi.update(editing, payload);
      cancel();
      load();
    } catch (e) {
      setErr(e);
    }
  }
  async function removeRow(id: number) {
    if (!confirm("Supprimer cet utilisateur ?")) return;
    try {
      await usersApi.remove(id);
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
        <h2>Utilisateurs</h2>
        <button className="btn" onClick={() => nav("/users/new", navState(PARENT, SELF))}>+ Ajouter</button>
      </div>
      <ErrorBanner error={err} />
      <p className="muted">
        Reflet local des comptes Keycloak. <strong>Le rôle et l'email sont resynchronisés
        depuis le realm</strong> à chaque connexion : les modifier ici ne tient que jusqu'à
        la suivante. Décocher « Actif » est le seul levier de révocation immédiate côté
        application.
      </p>
      <p className="muted">{filteredCount} sur {totalCount}</p>

      <table>
        <thead>
          <tr>
            {sortHeader("Nom", "nom", (u: User) => u.nom)}
            {sortHeader("Email", "email", (u: User) => u.email)}
            {sortHeader("Rôle", "role", (u: User) => USER_ROLE_LABELS[u.role])}
            {sortHeader("Actif", "actif", (u: User) => u.actif ? 1 : 0)}
            <th></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((u) =>
            isEditing(u.id) ? (
              <tr key={u.id} className="editing">
                <td>
                  <input
                    value={editDraft.nom ?? ""}
                    onChange={(ev) => patch({nom: ev.target.value })}
                  />
                </td>
                <td>
                  <input
                    type="email"
                    value={editDraft.email ?? ""}
                    onChange={(ev) => patch({email: ev.target.value })}
                  />
                </td>
                <td>
                  <select
                    value={editDraft.role ?? "membre"}
                    onChange={(ev) => patch({role: ev.target.value as UserRole })}
                  >
                    {USER_ROLES.map((r) => <option key={r} value={r}>{USER_ROLE_LABELS[r]}</option>)}
                  </select>
                </td>
                <td>
                  <input
                    type="checkbox"
                    checked={!!editDraft.actif}
                    onChange={(ev) => patch({actif: ev.target.checked })}
                  />
                </td>
                <td className="row-actions">
                  <button className="btn" onClick={saveEdit}>Enregistrer</button>
                  <button className="btn secondary" onClick={cancel}>Annuler</button>
                  <BoutonSupprimer onClick={() => removeRow(u.id)}>Supprimer</BoutonSupprimer>
                </td>
              </tr>
            ) : (
              <tr key={u.id}>
                <td>{u.nom}</td>
                <td>{u.email}</td>
                <td>{USER_ROLE_LABELS[u.role]}</td>
                <td>{u.actif ? "Oui" : "Non"}</td>
                <td><button className="btn secondary" onClick={() => startEdit(u)}>Éditer</button></td>
              </tr>
            )
          )}
        </tbody>
      </table>
    </>
  );
}
