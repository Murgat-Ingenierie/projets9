// Paramètres / Sauvegardes — SPEC §4, écran 11 : « déclencher un dump, voir
// l'historique des backups ».
//
// Volontairement SANS téléchargement : servir un dump depuis l'application
// serait un chemin d'exfiltration complet de la base, d'autant que
// l'authentification est aujourd'hui périmétrique (VHost). On liste, on
// demande — la restauration reste en ligne de commande (docs/RESTORE.md).

import { useEffect, useState } from "react";
import { backups } from "../api/endpoints";
import { ErrorBanner } from "../components/ErrorBanner";
import type { BackupFile } from "../types";

/** 12 345 678 → « 11,8 Mo ». */
function fmtTaille(octets: number): string {
  if (octets < 1024) return `${octets} o`;
  const ko = octets / 1024;
  if (ko < 1024) return `${ko.toFixed(1)} Ko`;
  return `${(ko / 1024).toFixed(1)} Mo`;
}

function fmtDateHeure(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ParametresPage() {
  const [liste, setListe] = useState<BackupFile[]>([]);
  const [err, setErr] = useState<unknown>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [chargement, setChargement] = useState(true);

  function load() {
    backups
      .list()
      .then(setListe)
      .catch(setErr)
      .finally(() => setChargement(false));
  }
  useEffect(load, []);

  async function demanderSauvegarde() {
    setErr(null);
    setInfo(null);
    setEnCours(true);
    try {
      const r = await backups.request();
      setInfo(r.detail);
      // Le dump est asynchrone (le conteneur `backup` scrute toutes les 5 s) :
      // on rafraîchit une fois après un délai, sans prétendre que c'est fini.
      setTimeout(load, 8000);
    } catch (e) {
      setErr(e);
    } finally {
      setEnCours(false);
    }
  }

  return (
    <>
      <div className="page-header">
        <h2>Paramètres</h2>
      </div>

      <ErrorBanner error={err} />

      <h3>Sauvegardes</h3>
      <p className="muted">
        Une sauvegarde automatique est effectuée chaque nuit à 03h00. Vous pouvez en
        demander une immédiatement — elle apparaîtra dans l'historique une fois terminée.
      </p>

      <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "12px 0 20px" }}>
        <button className="btn" onClick={demanderSauvegarde} disabled={enCours}>
          {enCours ? "Demande en cours…" : "Sauvegarder maintenant"}
        </button>
        <button className="btn secondary" onClick={load}>
          Rafraîchir
        </button>
        {info && <span className="muted">{info}</span>}
      </div>

      <h3>Historique ({liste.length})</h3>
      {chargement ? (
        <p>Chargement…</p>
      ) : liste.length === 0 ? (
        <p className="muted">
          Aucune sauvegarde pour l'instant. Si le service vient de démarrer, la première
          arrive dans quelques instants.
        </p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Fichier</th>
              <th>Date</th>
              <th>Taille</th>
            </tr>
          </thead>
          <tbody>
            {liste.map((b) => (
              <tr key={b.nom}>
                <td>{b.nom}</td>
                <td>{fmtDateHeure(b.date)}</td>
                <td>{fmtTaille(b.taille_octets)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p className="muted" style={{ marginTop: 20 }}>
        La restauration ne se fait pas depuis l'application : elle suit la procédure
        documentée dans <code>docs/RESTORE.md</code>. Les sauvegardes ne sont pas
        téléchargeables ici — un dump contient l'intégralité de la base.
      </p>
    </>
  );
}
