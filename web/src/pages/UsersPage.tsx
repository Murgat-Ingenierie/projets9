import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { users as usersApi } from "../api/endpoints";
import { ErrorBanner } from "../components/ErrorBanner";
import { useSortableList } from "../hooks/useSort";
import { USER_ROLE_LABELS } from "../labels";
import type { User, UserRole } from "../types";

const ROLES: UserRole[] = ["admin", "membre"];

export default function UsersPage() {
  const nav = useNavigate();
  const [items, setItems] = useState<User[]>([]);
  const [err, setErr] = useState<unknown>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<{
    nom?: string;
    email?: string;
    password?: string;
    role?: UserRole;
    actif?: boolean;
  }>({});

  function load() {
    usersApi.list().then(setItems).catch(setErr);
  }
  useEffect(load, []);

  const { sorted, sortHeader, filteredCount, totalCount } = useSortableList(items);

  function startEdit(u: User) {
    setEditing(u.id);
    setEditDraft({ nom: u.nom, email: u.email, role: u.role, actif: u.actif });
    setErr(null);
  }
  function cancelEdit() {
    setEditing(null);
    setEditDraft({});
  }
  async function saveEdit() {
    if (editing == null) return;
    setErr(null);
    const payload: any = {
      nom: editDraft.nom,
      email: editDraft.email,
      role: editDraft.role,
      actif: editDraft.actif,
    };
    if (editDraft.password) payload.password = editDraft.password;
    try {
      await usersApi.update(editing, payload);
      cancelEdit();
      load();
    } catch (e) {
      setErr(e);
    }
  }
  async function removeRow(id: number) {
    if (!confirm("Supprimer cet utilisateur ?")) return;
    try {
      await usersApi.remove(id);
      cancelEdit();
      load();
    } catch (e) {
      setErr(e);
    }
  }

  return (
    <>
      <div className="page-header">
        <h2>Utilisateurs</h2>
        <button className="btn" onClick={() => nav("/users/new")}>+ Ajouter</button>
      </div>
      <ErrorBanner error={err} />
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
            editing === u.id ? (
              <tr key={u.id} className="editing">
                <td>
                  <input
                    value={editDraft.nom ?? ""}
                    onChange={(ev) => setEditDraft({ ...editDraft, nom: ev.target.value })}
                  />
                </td>
                <td>
                  <input
                    type="email"
                    value={editDraft.email ?? ""}
                    onChange={(ev) => setEditDraft({ ...editDraft, email: ev.target.value })}
                  />
                </td>
                <td>
                  <select
                    value={editDraft.role ?? "membre"}
                    onChange={(ev) => setEditDraft({ ...editDraft, role: ev.target.value as UserRole })}
                  >
                    {ROLES.map((r) => <option key={r} value={r}>{USER_ROLE_LABELS[r]}</option>)}
                  </select>
                </td>
                <td>
                  <input
                    type="checkbox"
                    checked={!!editDraft.actif}
                    onChange={(ev) => setEditDraft({ ...editDraft, actif: ev.target.checked })}
                  />
                </td>
                <td className="row-actions">
                  <input
                    type="password"
                    placeholder="(mot de passe inchangé)"
                    style={{ width: 160 }}
                    value={editDraft.password ?? ""}
                    onChange={(ev) => setEditDraft({ ...editDraft, password: ev.target.value })}
                  />
                  <button className="btn" onClick={saveEdit}>Enregistrer</button>
                  <button className="btn secondary" onClick={cancelEdit}>Annuler</button>
                  <button className="btn danger" onClick={() => removeRow(u.id)}>Supprimer</button>
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
