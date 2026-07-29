"""Génère un classeur d'exemple conforme au format attendu par l'import.

Sert deux buts :
  1. **Documentation exécutable** du format source (onglets + colonnes) — plus
     fiable qu'une description en prose, puisqu'il produit un vrai fichier.
  2. **Vérification** de l'import de bout en bout sans avoir les données réelles
     (qui vivent dans un `data/source.xlsx` hors dépôt).

    pip install -e "api/[scripts]"          # openpyxl
    python scripts/make_sample_source.py --out data/source.xlsx

Puis déposer le fichier dans **Paramètres → Import du classeur source**. L'import
se fait depuis l'application depuis qu'il n'y a plus de login maison sur lequel
un script pourrait s'authentifier ; le format, lui, n'a pas changé (spec :
docstring de `api/app/services/import_xlsx.py`).

Le jeu couvre volontairement : la création d'epics à la volée, des projets
terminés et en cours, des tâches liées par trigramme, un responsable rapproché
par nom, une tâche au trigramme inconnu (comptée « sans projet »), un projet non
planifié, et des jalons transverses (dont un daté par année seule).
"""

from __future__ import annotations

import argparse
import datetime as dt
from pathlib import Path

from openpyxl import Workbook

# (colonne d'en-tête, lignes) par onglet. `None` = cellule vide dans la source.
SHEETS: dict[str, tuple[list[str], list[list]]] = {
    "Chargés de projets": (
        ["Nom"],
        [["Camille Roux"], ["Julien Mercier"]],
    ),
    "Projets": (
        ["Nom", "Fin prévue", "Jalon de fin max", "Raison fin",
         "Trigramme projet", "Trigramme epic", "Rappel", "Terminé"],
        [
            ["Réfection du bassin de reproduction", 2027, None,
             "Risque sécheresse", "BDB", "O50", "Priorité haute", False],
            ["Circuit de recirculation", None, 2028, None,
             "CIR", "RDR", "", False],
            ["Audit énergétique", 2026, None, None, "AUD", "EPR", "", True],
        ],
    ),
    "Projet non plannifiés": (
        ["Nom"],
        [["Étude photovoltaïque"]],
    ),
    "Detail des tache de projet": (
        ["Trigramme projet", "(réservé)", "Nom", "Date début", "Date fin",
         "(réservé)", "Responsable", "(réservé)", "(réservé)", "Terminé"],
        [
            ["BDB", None, "Vidange et curage", dt.date(2026, 6, 1),
             dt.date(2026, 6, 20), None, "Camille Roux", None, None, True],
            ["BDB", None, "Maçonnerie", dt.date(2026, 6, 21),
             dt.date(2026, 8, 15), None, "Julien Mercier", None, None, False],
            # Sans dates → alignée sur la fenêtre du projet parent.
            ["CIR", None, "Pose des canalisations", None, None, None,
             "Julien Mercier", None, None, False],
            ["AUD", None, "Relevé des compteurs", dt.date(2026, 5, 10),
             dt.date(2026, 5, 30), None, "Camille Roux", None, None, True],
            # Trigramme inconnu → comptée « sans projet identifié ».
            ["ZZZ", None, "Tâche orpheline", None, None, None,
             "?", None, None, False],
        ],
    ),
    "Jalons": (
        ["Nom", "Date"],
        [
            ["Contrôle DDPP annuel", dt.date(2026, 9, 15)],
            ["Renouvellement autorisation de rejet", 2027],  # année seule
        ],
    ),
}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="data/source.xlsx")
    args = ap.parse_args()

    wb = Workbook()
    wb.remove(wb.active)  # retire la feuille vide par défaut
    for nom, (entete, lignes) in SHEETS.items():
        ws = wb.create_sheet(nom)
        ws.append(entete)
        for ligne in lignes:
            ws.append(ligne)

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    wb.save(out)
    print(f"Classeur d'exemple écrit : {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
