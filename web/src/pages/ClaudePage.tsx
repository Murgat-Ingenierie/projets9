// Claude — décrire un bug ou une idée, en ressortir avec une issue GitHub.
//
// Le fil vit ICI, dans l'état de la page : l'API est sans mémoire et reçoit
// tout le fil à chaque tour. Quitter la page efface la conversation — c'est
// voulu, une demande se règle en quelques échanges. Une fois l'issue ouverte,
// la suite est humaine : relecture, puis label « claude-fix » sur GitHub.

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { claude as claudeApi, type ChatMessage, type IssueCreee } from "../api/endpoints";
import { ErrorBanner } from "../components/ErrorBanner";

export default function ClaudePage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [saisie, setSaisie] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [issue, setIssue] = useState<IssueCreee | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const bas = useRef<HTMLDivElement>(null);
  const zoneSaisie = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bas.current?.scrollIntoView({ block: "end" });
  }, [messages, enCours]);

  // La zone est désactivée pendant l'appel, et un champ désactivé perd le
  // focus : sans ce rappel, il fallait recliquer dedans avant chaque nouveau
  // message (#131). On le rend donc dès qu'elle redevient active — après une
  // réponse comme après une erreur, où la saisie a été restituée. Au premier
  // rendu, cela place aussi le curseur, prêt pour le premier message.
  useEffect(() => {
    if (!enCours) zoneSaisie.current?.focus();
  }, [enCours]);

  async function envoyer() {
    const texte = saisie.trim();
    if (!texte || enCours) return;
    const fil: ChatMessage[] = [...messages, { role: "user", content: texte }];
    setMessages(fil);
    setSaisie("");
    setErr(null);
    setEnCours(true);
    try {
      const r = await claudeApi.chat(fil);
      setMessages([...fil, { role: "assistant", content: r.reply }]);
      if (r.issue) setIssue(r.issue);
    } catch (e) {
      setErr(e);
      // On rend la saisie pour que l'utilisateur ne la retape pas.
      setMessages(messages);
      setSaisie(texte);
    } finally {
      setEnCours(false);
    }
  }

  function surTouche(ev: KeyboardEvent<HTMLTextAreaElement>) {
    if (ev.key === "Enter" && !ev.shiftKey) {
      ev.preventDefault();
      void envoyer();
    }
  }

  function recommencer() {
    setMessages([]);
    setIssue(null);
    setErr(null);
    setSaisie("");
  }

  return (
    <>
      <div className="page-header">
        <h2>Claude</h2>
        {messages.length > 0 && (
          <button className="btn secondary" onClick={recommencer}>Nouvelle demande</button>
        )}
      </div>
      <p className="muted">
        Décris un bug ou une amélioration. Claude pose au besoin une question, puis ouvre
        une issue GitHub que l'équipe relit avant tout développement.
      </p>
      <ErrorBanner error={err} />

      <div className="chat">
        {messages.map((m, i) => (
          <div key={i} className={`chat-msg ${m.role}`}>{m.content}</div>
        ))}
        {enCours && <div className="chat-msg assistant muted">…</div>}
        {issue && (
          <div className="chat-issue">
            Issue <a href={issue.url} target="_blank" rel="noreferrer">#{issue.number}</a> ouverte.
            Elle sera relue par l'équipe.
          </div>
        )}
        <div ref={bas} />
      </div>

      {!issue && (
        <div className="chat-saisie">
          <textarea
            ref={zoneSaisie}
            value={saisie}
            onChange={(ev) => setSaisie(ev.target.value)}
            onKeyDown={surTouche}
            placeholder="Ex. : impossible de déplacer un jalon depuis le planning…"
            rows={2}
            disabled={enCours}
            aria-label="Votre message"
          />
          <button className="btn" onClick={envoyer} disabled={enCours || !saisie.trim()}>
            Envoyer
          </button>
        </div>
      )}
    </>
  );
}
