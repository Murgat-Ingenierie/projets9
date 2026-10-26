// Claude — déposer un bug ou une idée, en ressortir avec une issue GitHub.
//
// Le formulaire ouvre l'issue telle quelle ; le dialogue avec Claude se poursuit
// SUR l'issue (il relit, pose ses questions en commentaire, on lui répond avec
// @claude) — sous l'abonnement Claude Code, et avec une trace. La suite est
// humaine : relecture, puis label « claude-fix » sur GitHub.

import { useState, type FormEvent } from "react";
import { claude as claudeApi, type IssueCreee, type TypeDemande } from "../api/endpoints";
import { ErrorBanner } from "../components/ErrorBanner";

export default function ClaudePage() {
  const [type, setType] = useState<TypeDemande>("bug");
  const [titre, setTitre] = useState("");
  const [description, setDescription] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [issue, setIssue] = useState<IssueCreee | null>(null);
  const [err, setErr] = useState<unknown>(null);

  async function envoyer(ev: FormEvent) {
    ev.preventDefault();
    setErr(null);
    setEnCours(true);
    try {
      setIssue(await claudeApi.creerIssue({ type, titre, description }));
    } catch (e) {
      setErr(e);
    } finally {
      setEnCours(false);
    }
  }

  function recommencer() {
    setIssue(null);
    setTitre("");
    setDescription("");
    setErr(null);
  }

  if (issue) {
    return (
      <>
        <div className="page-header"><h2>Claude</h2></div>
        <div className="chat-issue">
          Issue <a href={issue.url} target="_blank" rel="noreferrer">#{issue.number}</a> ouverte.
        </div>
        <p className="muted" style={{ marginTop: 12 }}>
          Claude va la relire et poser ses questions en commentaire : réponds-lui sur GitHub
          en l'interpellant avec <code>@claude</code>. L'équipe valide ensuite le développement.
        </p>
        <button className="btn secondary" onClick={recommencer}>Nouvelle demande</button>
      </>
    );
  }

  return (
    <>
      <div className="page-header"><h2>Claude</h2></div>
      <p className="muted">
        Décris un bug ou une amélioration. L'issue est ouverte sur GitHub ; Claude la relit et
        te pose ses questions là-bas, puis l'équipe valide avant tout développement.
      </p>
      <ErrorBanner error={err} />

      <form onSubmit={envoyer} className="chat-saisie" style={{ flexDirection: "column", alignItems: "stretch" }}>
        <label>
          Type
          <select value={type} onChange={(ev) => setType(ev.target.value as TypeDemande)}>
            <option value="bug">Bug</option>
            <option value="amelioration">Amélioration</option>
          </select>
        </label>
        <label>
          Titre
          <input
            value={titre}
            onChange={(ev) => setTitre(ev.target.value)}
            placeholder="Ex. : impossible de déplacer un jalon depuis le planning"
            minLength={3}
            maxLength={100}
            required
          />
        </label>
        <label>
          Description
          <textarea
            value={description}
            onChange={(ev) => setDescription(ev.target.value)}
            placeholder="Où, quand, ce que tu attendais, ce qui s'est passé…"
            rows={6}
            minLength={10}
            maxLength={5000}
            required
          />
        </label>
        <div>
          <button className="btn" type="submit" disabled={enCours}>
            {enCours ? "Envoi…" : "Ouvrir l'issue"}
          </button>
        </div>
      </form>
    </>
  );
}
