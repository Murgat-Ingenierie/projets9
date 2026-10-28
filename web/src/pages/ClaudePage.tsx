// Claude — décrire un bug ou une idée, en ressortir avec une issue GitHub.
//
// Le fil vit ICI, dans l'état de la page : l'API est sans mémoire et reçoit
// tout le fil à chaque tour. Quitter la page efface la conversation — c'est
// voulu, une demande se règle en quelques échanges. Une fois l'issue ouverte,
// la suite est humaine : relecture, puis label « claude-fix » sur GitHub.

import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { claude as claudeApi, type ChatMessage, type IssueCreee } from "../api/endpoints";
import { ErrorBanner } from "../components/ErrorBanner";
import { IconeClaude } from "../components/IconeClaude";

/** Couleur de la marque Claude, réservée à son avatar dans le fil. */
const COULEUR_CLAUDE = "#d97757";

/** Hauteur maximale de la zone de saisie (px). Au-delà elle défile : sur un
 *  téléphone, une zone qui grandit sans limite repousserait le fil hors de
 *  l'écran, clavier virtuel déjà ouvert. */
const HAUTEUR_MAX_SAISIE = 200;

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

  // La zone suit son contenu (#130) : deux lignes fixes coupaient une
  // description de bug dès la troisième, et la poignée de redimensionnement
  // est introuvable au doigt. On remet la hauteur à `auto` avant de mesurer,
  // sinon elle ne pourrait que grandir — jamais se rétracter après un envoi.
  // `useLayoutEffect` : mesurer avant l'affichage évite un saut visible.
  useLayoutEffect(() => {
    const el = zoneSaisie.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, HAUTEUR_MAX_SAISIE)}px`;
  }, [saisie]);

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
        <h2 className="chat-titre">
          <IconeClaude taille={26} couleur={COULEUR_CLAUDE} />
          Claude
        </h2>
        {messages.length > 0 && (
          <button className="btn secondary" onClick={recommencer}>Nouvelle demande</button>
        )}
      </div>
      <p className="muted">
        Décris un bug ou une amélioration. Claude pose au besoin quelques questions, puis ouvre
        une issue GitHub que l'équipe relit avant tout développement.
      </p>
      <ErrorBanner error={err} />

      <div className="chat">
        {messages.map((m, i) =>
          m.role === "assistant" ? (
            <div key={i} className="chat-ligne assistant">
              <Avatar />
              <div className="chat-msg assistant">{m.content}</div>
            </div>
          ) : (
            <div key={i} className="chat-msg user">{m.content}</div>
          ),
        )}
        {/* Trois points animés plutôt qu'un « … » figé : sans mouvement, rien
            ne distinguait une réponse en préparation d'un écran bloqué. */}
        {enCours && (
          <div className="chat-ligne assistant">
            <Avatar />
            <div className="chat-msg assistant chat-attente" role="status" aria-label="Claude rédige sa réponse">
              <span /><span /><span />
            </div>
          </div>
        )}
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
          {/* Zone et bouton dans un même cadre, qui porte le focus : l'ensemble
              se lit comme UN champ, comme dans les messageries usuelles. */}
          <div className="chat-saisie-cadre">
            <textarea
              ref={zoneSaisie}
              value={saisie}
              onChange={(ev) => setSaisie(ev.target.value)}
              onKeyDown={surTouche}
              placeholder="Ex. : impossible de déplacer un jalon depuis le planning…"
              rows={1}
              disabled={enCours}
              aria-label="Votre message"
            />
            <button
              type="button"
              className="chat-envoyer"
              onClick={envoyer}
              disabled={enCours || !saisie.trim()}
              aria-label="Envoyer"
              title="Envoyer"
            >
              <span className="material-symbols-outlined">arrow_upward</span>
            </button>
          </div>
          <div className="chat-aide">Entrée pour envoyer · Maj + Entrée pour aller à la ligne</div>
        </div>
      )}
    </>
  );
}

function Avatar() {
  return (
    <span className="chat-avatar" aria-hidden="true">
      <IconeClaude taille={18} couleur={COULEUR_CLAUDE} />
    </span>
  );
}
