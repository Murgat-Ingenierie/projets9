import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "../api/endpoints";
import { useAuth } from "../auth";
import { ErrorBanner } from "../components/ErrorBanner";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<unknown>(null);
  const { login } = useAuth();
  const nav = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      const r = await auth.login(email, password);
      login(r.user, r.access_token);
      nav("/");
    } catch (e) {
      setErr(e);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <h2>Connexion</h2>
        <form className="form" onSubmit={submit}>
          <label>Email</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
          <label>Mot de passe</label>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            required
          />
          <ErrorBanner error={err} />
          <button className="btn" type="submit">Se connecter</button>
        </form>
      </div>
    </div>
  );
}
