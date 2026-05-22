import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { users as usersApi } from "../api/endpoints";
import { Breadcrumb } from "../components/Breadcrumb";
import { ErrorBanner } from "../components/ErrorBanner";
import { USER_ROLE_LABELS } from "../labels";
import type { UserRole } from "../types";

const ROLES: UserRole[] = ["admin", "membre"];

export default function UserNewPage() {
  const nav = useNavigate();
  const [err, setErr] = useState<unknown>(null);
  const [draft, setDraft] = useState({
    nom: "",
    email: "",
    password: "",
    role: "membre" as UserRole,
    actif: true,
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      await usersApi.create(draft);
      nav("/users");
    } catch (e) {
      setErr(e);
    }
  }

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Planning", to: "/" },
          { label: "Utilisateurs", to: "/users" },
          { label: "Nouvel utilisateur" },
        ]}
      />
      <h2>Nouvel utilisateur</h2>
      <ErrorBanner error={err} />
      <form className="form" onSubmit={submit}>
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
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button className="btn" type="submit">Créer</button>
          <button type="button" className="btn secondary" onClick={() => nav("/users")}>Annuler</button>
        </div>
      </form>
    </>
  );
}
