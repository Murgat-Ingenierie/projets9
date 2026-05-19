import { useEffect, useState } from "react";
import { users as usersApi } from "../api/endpoints";
import { ErrorBanner } from "../components/ErrorBanner";
import { useSortableList } from "../hooks/useSort";
import { USER_ROLE_LABELS } from "../labels";
import type { User, UserRole } from "../types";

const ROLES: UserRole[] = ["admin", "membre"];

export default function UsersPage() {
  const [items, setItems] = useState<User[]>([]);
  const [err, setErr] = useState<unknown>(null);
  const [draft, setDraft] = useState({
    nom: "",
    email: "",
    password: "",
    role: "membre" as UserRole,
    actif: true,
  });
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

  const { sorted, sortHeader } = useSortableList(items);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      await usersApi.create(draft);
      setDraft({ nom: "", email: "", password: "", role: "membre", actif: true });
      load();
    } catch (e) {
      setErr(e);
    }
  }

  async function remove(id: number) {
    if (!confirm("Supprimer cet utilisateur ?")) return;
    try {
      await usersApi.remove(id);
      load();
    } catch (e) {
      setErr(e);
    }
  }

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

  return (
    <>
      <h2>Utilisateurs</h2>
      <ErrorBanner error={err} />
      <form className="form" onSubmit={create} style={{ marginBottom: 24 }}>
        <label>Nom</label>
        <input value={draft.nom} onChange={(e) => setDraft({ ...draft, nom: e.target.value })} required />
        <label>Email</label>
        <input
          type="email"
          value={draft.email}
          onChange={(e) => setDraft({ ...draft, email: e.target.value })}
          required
        />
        <label>Mot de passe (8 caractères minimum)</label>
        <input
          type="password"
          minLength={8}
          value={draft.password}
          onChange={(e) => setDraft({ ...draft, password: e.target.value })}
          required
        />
        <label>Rôle</label>
        <select value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value as UserRole })}>
          {ROLES.map((r) => <option key={r} value={r}>{USER_ROLE_LABELS[r]}</option>)}
        </select>
        <button className="btn" type="submit">Ajouter</button>
      </form>

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
                <td>
                  <input
                    type="password"
                    placeholder="(inchangé)"
                    style={{ width: 130, marginRight: 4 }}
                    value={editDraft.password ?? ""}
                    onChange={(ev) => setEditDraft({ ...editDraft, password: ev.target.value })}
                  />
                  <button className="btn" onClick={saveEdit}>Enregistrer</button>{" "}
                  <button className="btn secondary" onClick={cancelEdit}>Annuler</button>
                </td>
              </tr>
            ) : (
              <tr key={u.id}>
                <td>{u.nom}</td>
                <td>{u.email}</td>
                <td>{USER_ROLE_LABELS[u.role]}</td>
                <td>{u.actif ? "Oui" : "Non"}</td>
                <td>
                  <button className="btn secondary" onClick={() => startEdit(u)}>Éditer</button>{" "}
                  <button className="btn danger" onClick={() => remove(u.id)}>Supprimer</button>
                </td>
              </tr>
            )
          )}
        </tbody>
      </table>
    </>
  );
}
