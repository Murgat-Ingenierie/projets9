import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { epics, measures, milestones, projects } from "../api/endpoints";
import { ErrorBanner } from "../components/ErrorBanner";
import { PROJECT_STATUS_LABELS, fmtDate } from "../labels";
import type { Epic, Measure, Milestone, Project } from "../types";

export default function EpicDetailPage() {
  const { trigramme = "" } = useParams();
  const [epic, setEpic] = useState<Epic | null>(null);
  const [projs, setProjs] = useState<Project[]>([]);
  const [jalons, setJalons] = useState<Milestone[]>([]);
  const [mes, setMes] = useState<Measure[]>([]);
  const [err, setErr] = useState<unknown>(null);

  function load() {
    Promise.all([
      epics.get(trigramme),
      projects.list(trigramme),
      milestones.list({ epic: trigramme }),
      measures.list(trigramme),
    ])
      .then(([e, p, j, m]) => {
        setEpic(e);
        setProjs(p);
        setJalons(j);
        setMes(m);
      })
      .catch(setErr);
  }
  useEffect(load, [trigramme]);

  async function toggleCritere() {
    if (!epic) return;
    try {
      const updated = await epics.update(epic.trigramme, {
        critere_atteint: !epic.critere_atteint,
      });
      setEpic(updated);
    } catch (e) {
      setErr(e);
    }
  }

  if (!epic) return <p>Chargement…</p>;

  return (
    <>
      <h2>{epic.nom}</h2>
      <ErrorBanner error={err} />
      <p><strong>Critère de réussite :</strong> {epic.critere_reussite || "—"}</p>
      <p><strong>Raison de la date de fin :</strong> {epic.raison_date_fin || "—"}</p>
      <p><strong>Date de fin prévue :</strong> {fmtDate(epic.date_fin_prevue) || "—"}</p>
      <p><strong>Jalon de fin maximum :</strong> {fmtDate(epic.jalon_fin_max) || "—"}</p>
      <p>
        <label>
          <input type="checkbox" checked={epic.critere_atteint} onChange={toggleCritere} />
          {" "}Critère atteint
        </label>
      </p>

      <h3>Projets</h3>
      <table>
        <thead>
          <tr><th>Nom</th><th>Début</th><th>Fin</th><th>Statut</th></tr>
        </thead>
        <tbody>
          {projs.map((p) => (
            <tr key={p.id}>
              <td>{p.nom}</td>
              <td>{fmtDate(p.date_debut)}</td>
              <td>{fmtDate(p.date_fin)}</td>
              <td><span className={`tag ${p.statut}`}>{PROJECT_STATUS_LABELS[p.statut]}</span></td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>Jalons</h3>
      <table>
        <thead>
          <tr><th>Nom</th><th>Date</th><th>Atteint</th></tr>
        </thead>
        <tbody>
          {jalons.map((j) => (
            <tr key={j.id}>
              <td>{j.nom}</td>
              <td>{fmtDate(j.date)}</td>
              <td>{j.atteint ? "Oui" : "Non"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>Mesures</h3>
      <table>
        <thead>
          <tr><th>Date</th><th>Valeur</th><th>Unité</th><th>Commentaire</th></tr>
        </thead>
        <tbody>
          {mes.map((m) => (
            <tr key={m.id}>
              <td>{fmtDate(m.date)}</td>
              <td>{m.valeur}</td>
              <td>{m.unite}</td>
              <td>{m.commentaire}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
