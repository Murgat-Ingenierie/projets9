import { useEffect, useState } from "react";
import { users as usersApi } from "../api/endpoints";
import { ErrorBanner } from "../components/ErrorBanner";
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

  function load() {
    usersApi.list().then(setItems).catch(setErr);
  }
  useEffect(load, []);

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

  async function toggleActive(u: User) {
    try {
      await usersApi.update(u.id, { actif: !u.actif });
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
        <select
          value={draft.role}
          onChange={(e) => setDraft({ ...draft, role: e.target.value as UserRole })}
        >
          {ROLES.map((r) => <option key={r} value={r}>{USER_ROLE_LABELS[r]}</option>)}
        </select>
        <button className="btn" type="submit">Ajouter</button>
      </form>

      <table>
        <thead>
          <tr>
            <th>Nom</th><th>Email</th><th>Rôle</th><th>Actif</th><th></th>
          </tr>
        </thead>
        <tbody>
          {items.map((u) => (
            <tr key={u.id}>
              <td>{u.nom}</td>
              <td>{u.email}</td>
              <td>{USER_ROLE_LABELS[u.role]}</td>
              <td>
                <button className="btn secondary" onClick={() => toggleActive(u)}>
                  {u.actif ? "Désactiver" : "Activer"}
                </button>
              </td>
              <td><button className="btn danger" onClick={() => remove(u.id)}>Supprimer</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
