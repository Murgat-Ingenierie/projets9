// Journal d'activité d'une tâche : ce qui a été fait, quand, par qui.
//
// Retour d'usage — « avoir une notion d'activité dans chaque tâche ("j'ai vissé
// les boulons c'était super") ».
//
// IMMUABLE. Rien ici ne permet de modifier une entrée publiée, et l'API n'expose
// même pas la route : c'est ce qui en fait une trace plutôt qu'une note. La
// suppression existe — une saisie sur la mauvaise tâche, ça arrive — mais elle
// est réservée aux administrateurs, sans quoi l'immuabilité serait illusoire
// (supprimer puis republier reviendrait à réécrire).
//
// Comme la liste de contrôle, ce bloc vit HORS du `<form>` de la tâche : il écrit
// immédiatement, et sa zone de saisie a besoin de sa propre soumission.

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

import { activites as activitesApi } from "../api/endpoints";
import type { TaskActivite } from "../types";
import { BoutonSupprimer } from "./BoutonSupprimer";
import { ErrorBanner } from "./ErrorBanner";

interface Props {
  tacheId: number;
}

/** « 5 août 2026 à 14:32 » — lisible, et sans dépendance de formatage. */
function quand(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Ancre de la section, visée par le bouton « Activité » de la liste des tâches. */
export const ANCRE_ACTIVITE = "activite";

export function JournalActivite({ tacheId }: Props) {
  const [entrees, setEntrees] = useState<TaskActivite[]>([]);
  const [texte, setTexte] = useState("");
  const [err, setErr] = useState<unknown>(null);
  const section = useRef<HTMLElement>(null);
  const { hash } = useLocation();
  // Une seule fois : sans ce garde, toute écriture rechargerait la liste et
  // ramènerait l'écran ici, alors que l'utilisateur a pu défiler ailleurs entre-temps.
  const dejaAmene = useRef(false);

  const recharger = useCallback(() => {
    activitesApi.list(tacheId).then(setEntrees).catch(setErr);
  }, [tacheId]);

  useEffect(recharger, [recharger]);

  // Amener la section à l'écran quand on arrive par le bouton « Activité » de la
  // liste des tâches. Déclenché à l'ARRIVÉE des entrées, pas au montage : la
  // section est alors à sa hauteur définitive, sinon on viserait un bloc vide qui
  // grandit ensuite sous le point d'arrivée.
  useEffect(() => {
    if (dejaAmene.current) return;
    if (hash !== `#${ANCRE_ACTIVITE}`) return;
    dejaAmene.current = true;
    section.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [hash, entrees]);

  async function publier(e: React.FormEvent) {
    e.preventDefault();
    const propre = texte.trim();
    if (!propre) return;
    setErr(null);
    try {
      await activitesApi.create({ tache_id: tacheId, texte: propre });
      // Vidé APRÈS l'écriture : effacer d'abord perdrait un compte rendu qu'on
      // vient de rédiger si l'API refuse.
      setTexte("");
      recharger();
    } catch (e) {
      setErr(e);
    }
  }

  async function retirer(a: TaskActivite) {
    if (!confirm("Supprimer définitivement cette entrée du journal ?")) return;
    setErr(null);
    try {
      await activitesApi.remove(a.id);
      recharger();
    } catch (e) {
      setErr(e);
    }
  }

  return (
    <section id={ANCRE_ACTIVITE} ref={section} style={{ marginTop: 20, scrollMarginTop: 64 }}>
      <h3 style={{ fontSize: 15, margin: "0 0 8px" }}>Activité</h3>
      <ErrorBanner error={err} />

      {/* La saisie est EN TÊTE, avant les entrées : la liste n'a pas de fin, et
          la reléguer en bas obligerait à la chercher plus bas à chaque fois. */}
      <form onSubmit={publier} style={{ marginBottom: 12 }}>
        <textarea
          rows={2}
          value={texte}
          onChange={(e) => setTexte(e.target.value)}
          placeholder="Ce qui a été fait…"
          maxLength={2000}
          aria-label="Nouvelle entrée d'activité"
          style={{ width: "100%" }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
          <button className="btn secondary" type="submit" disabled={!texte.trim()}>
            Publier
          </button>
          {/* Dit AVANT d'écrire ce qui ne pourra plus être défait. L'apprendre
              après coup, en cherchant un bouton « modifier » qui n'existe pas,
              serait une mauvaise surprise. */}
          <small className="muted">Une entrée publiée ne peut plus être modifiée.</small>
        </div>
      </form>

      {entrees.length === 0 && <p className="muted" style={{ margin: 0 }}>Rien n'a encore été consigné.</p>}

      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {entrees.map((a) => (
          <li
            key={a.id}
            style={{ borderLeft: "2px solid #e0e0e0", padding: "2px 0 6px 10px", marginBottom: 8 }}
          >
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <strong style={{ fontSize: 13 }}>{a.auteur_nom}</strong>
              <span className="muted" style={{ fontSize: 12 }}>{quand(a.created_at)}</span>
              <span style={{ flex: 1 }} />
              {/* `BoutonSupprimer` masque l'action aux membres, ce qui est ici la
                  règle voulue : l'API répond 403 de toute façon, et proposer un
                  bouton pour refuser ensuite serait le défaut corrigé en #88. */}
              <BoutonSupprimer
                onClick={() => retirer(a)}
                className="btn danger"
                title={`Supprimer l'entrée de ${a.auteur_nom}`}
              >
                Supprimer
              </BoutonSupprimer>
            </div>
            {/* `pre-wrap` : un compte rendu tapé sur plusieurs lignes doit se
                relire tel qu'il a été écrit. */}
            <p style={{ margin: "2px 0 0", whiteSpace: "pre-wrap" }}>{a.texte}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
