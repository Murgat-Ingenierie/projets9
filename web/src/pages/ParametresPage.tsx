// Paramètres — deux opérations d'administration (SPEC §4, écran 11).
//
// **Import du classeur** : remplace `scripts/import_data.py` comme chemin
// nominal. Le script s'authentifiait sur le login maison, retiré avec Keycloak ;
// déposer le fichier depuis une page déjà authentifiée évite d'inventer un
// compte de service. L'import passe par les mêmes routes que la saisie manuelle,
// donc par les invariants : une ligne refusée est rapportée, jamais insérée.
//
// **Sauvegardes** : déclencher un dump, voir l'historique. Volontairement SANS
// téléchargement — servir un dump depuis l'application serait un chemin
// d'exfiltration complet de la base. La restauration reste en ligne de commande
// (docs/RESTORE.md).

import { useEffect, useState } from "react";
import { backups, imports, type RapportImport } from "../api/endpoints";
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

  // --- Import du classeur source ---
  const [fichier, setFichier] = useState<File | null>(null);
  const [importEnCours, setImportEnCours] = useState(false);
  const [rapport, setRapport] = useState<RapportImport | null>(null);

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

  async function lancerImport() {
    if (!fichier) return;
    setErr(null);
    setRapport(null);
    setImportEnCours(true);
    try {
      setRapport(await imports.xlsx(fichier));
    } catch (e) {
      setErr(e);
    } finally {
      setImportEnCours(false);
    }
  }

  return (
    <>
      <div className="page-header">
        <h2>Paramètres</h2>
      </div>

      <ErrorBanner error={err} />

      <h3>Import du classeur source</h3>
      <p className="muted">
        Dépose l'export <code>.xlsx</code> du tableur de suivi. L'import passe par les
        mêmes règles métier que la saisie manuelle : une ligne incohérente est{" "}
        <strong>refusée et signalée</strong>, jamais enregistrée à moitié. Rejouer le même
        fichier ne crée pas de doublon.
      </p>

      <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "12px 0 20px" }}>
        <input
          type="file"
          accept=".xlsx"
          onChange={(ev) => {
            setFichier(ev.target.files?.[0] ?? null);
            setRapport(null);
          }}
        />
        <button className="btn" onClick={lancerImport} disabled={!fichier || importEnCours}>
          {importEnCours ? "Import en cours…" : "Importer"}
        </button>
      </div>

      {rapport && (
        <div style={{ marginBottom: 24 }}>
          <table>
            <tbody>
              <tr><td>Projets créés</td><td>{rapport.projets_crees}</td></tr>
              <tr><td>Projets déjà présents</td><td>{rapport.projets_deja_presents}</td></tr>
              <tr><td>Projets non planifiés</td><td>{rapport.projets_non_planifies}</td></tr>
              <tr><td>Tâches créées</td><td>{rapport.taches_creees}</td></tr>
              <tr><td>Tâches déjà présentes</td><td>{rapport.taches_deja_presentes}</td></tr>
              <tr><td>Tâches sans projet identifié</td><td>{rapport.taches_sans_projet}</td></tr>
              <tr><td>Utilisateurs créés</td><td>{rapport.utilisateurs_crees}</td></tr>
              {rapport.jalons && <tr><td>Jalons</td><td>{rapport.jalons}</td></tr>}
            </tbody>
          </table>

          {rapport.refus.length > 0 ? (
            <>
              {/* Le coeur du rapport : ce qui n'est PAS passé, et pourquoi.
                  L'afficher discrètement laisserait croire l'import complet. */}
              <h4 style={{ marginTop: 16 }}>
                {rapport.refus.length} ligne{rapport.refus.length > 1 ? "s" : ""} refusée
                {rapport.refus.length > 1 ? "s" : ""}
              </h4>
              <p className="muted">
                Ces lignes n'ont pas été enregistrées : elles contredisent une règle métier.
                Corrige la source, puis relance l'import.
              </p>
              <ul>
                {rapport.refus.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </>
          ) : (
            <p className="muted">Aucune ligne refusée.</p>
          )}
        </div>
      )}

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
