// Liste de contrôle d'une tâche : un libellé, une case.
//
// Retour d'usage — « avoir une liste des todo dans une tâche ». Ce ne sont pas
// des sous-tâches : la hiérarchie du produit s'arrête à Epic → Projet → Tâche, et
// tout ce qui porte des dates, un responsable ou des dépendances est une tâche.
// Un todo ne pèse sur aucun planning, aucune charge, aucun invariant.
//
// Elle vit HORS du `<form>` de la tâche, pour deux raisons :
//
//  - elle écrit IMMÉDIATEMENT (cocher, ajouter, retirer), là où le formulaire
//    attend « Enregistrer ». Les mêler laisserait croire qu'« Annuler » défait
//    aussi les cases cochées ;
//  - le champ d'ajout a besoin de sa propre soumission. À l'intérieur du
//    formulaire de tâche, la touche Entrée aurait enregistré la TÂCHE.

import { useCallback, useEffect, useState } from "react";

import { todos as todosApi } from "../api/endpoints";
import type { TaskTodo } from "../types";
import { ErrorBanner } from "./ErrorBanner";

interface Props {
  tacheId: number;
}

export function ListeTodos({ tacheId }: Props) {
  const [liste, setListe] = useState<TaskTodo[]>([]);
  const [libelle, setLibelle] = useState("");
  const [err, setErr] = useState<unknown>(null);

  const recharger = useCallback(() => {
    todosApi.list(tacheId).then(setListe).catch(setErr);
  }, [tacheId]);

  useEffect(recharger, [recharger]);

  async function ajouter(e: React.FormEvent) {
    e.preventDefault();
    const texte = libelle.trim();
    if (!texte) return;
    setErr(null);
    try {
      await todosApi.create({ tache_id: tacheId, libelle: texte });
      // Vidé APRÈS l'écriture : effacer d'abord perdrait la saisie si l'API refuse.
      setLibelle("");
      recharger();
    } catch (e) {
      setErr(e);
    }
  }

  async function basculer(t: TaskTodo) {
    setErr(null);
    // On n'envoie QUE `fait` : la route applique les champs fournis, transmettre
    // le libellé au passage risquerait de réécrire ce qu'on n'a pas touché.
    try {
      await todosApi.update(t.id, { fait: !t.fait });
      recharger();
    } catch (e) {
      setErr(e);
    }
  }

  async function retirer(t: TaskTodo) {
    setErr(null);
    try {
      await todosApi.remove(t.id);
      recharger();
    } catch (e) {
      setErr(e);
    }
  }

  const faits = liste.filter((t) => t.fait).length;

  return (
    <section style={{ marginTop: 20 }}>
      <h3 style={{ fontSize: 15, margin: "0 0 8px" }}>
        À faire{" "}
        {liste.length > 0 && (
          <span className="muted" style={{ fontWeight: 400 }}>
            ({faits}/{liste.length})
          </span>
        )}
      </h3>
      <ErrorBanner error={err} />

      {liste.length === 0 && <p className="muted" style={{ margin: "0 0 8px" }}>Aucun point pour l'instant.</p>}

      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {liste.map((t) => (
          <li key={t.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 0" }}>
            <input
              type="checkbox"
              checked={t.fait}
              onChange={() => basculer(t)}
              // Le libellé EST l'intitulé de la case : pas de `<label>` séparé à
              // relier, le nom accessible vient de là.
              aria-label={t.libelle}
            />
            <span style={{ flex: 1, textDecoration: t.fait ? "line-through" : undefined, opacity: t.fait ? 0.6 : 1 }}>
              {t.libelle}
            </span>
            {/* Pas de `BoutonSupprimer` ici : ce composant masque l'action aux
                membres, ce qui est juste partout ailleurs — la portée d'une
                suppression y est une cascade. Un todo n'emporte que lui-même, et
                c'est la liste qu'on coche EN FAISANT le travail : une ligne mal
                saisie qu'il faudrait faire retirer par un administrateur rendrait
                l'outil pénible. L'API l'autorise donc explicitement. */}
            <button
              type="button"
              className="btn danger"
              style={{ padding: "1px 7px", lineHeight: 1.4 }}
              onClick={() => retirer(t)}
              title={`Retirer « ${t.libelle} »`}
              // Le contenu du bouton est « × » : sans intitulé explicite, un
              // lecteur d'écran annonce « × » pour toutes les lignes, et rien ne
              // les distingue. Le `title` seul ne suffit pas — le contenu prime
              // sur lui dans le calcul du nom accessible.
              aria-label={`Retirer « ${t.libelle} »`}
            >
              ×
            </button>
          </li>
        ))}
      </ul>

      <form onSubmit={ajouter} style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <input
          value={libelle}
          onChange={(e) => setLibelle(e.target.value)}
          placeholder="Ajouter un point…"
          maxLength={200}
          aria-label="Ajouter un point"
          style={{ flex: 1 }}
        />
        <button className="btn secondary" type="submit" disabled={!libelle.trim()}>
          Ajouter
        </button>
      </form>
    </section>
  );
}
