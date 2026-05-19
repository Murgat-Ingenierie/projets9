"""Attribue une couleur à chaque epic.

Mapping sémantique pour les trigrammes connus (lié au sens du critère),
puis fallback algorithmique pour les autres.

Idempotent : ne touche pas un epic dont `couleur` est déjà défini.
Pour forcer la ré-attribution, passer `--force`.

Utilisation :
    /tmp/xlsxvenv/bin/python scripts/seed_colors.py [--force] [--api http://localhost:8088]
"""

from __future__ import annotations

import argparse
import sys

import requests


# Palette Material 700 — 14 couleurs visuellement distinctes
FALLBACK_PALETTE = [
    "#1976d2",  # blue
    "#00897b",  # teal
    "#2e7d32",  # green
    "#ef6c00",  # orange
    "#d32f2f",  # red
    "#7b1fa2",  # purple
    "#3f51b5",  # indigo
    "#0097a7",  # cyan
    "#689f38",  # light green
    "#c2185b",  # pink
    "#512da8",  # deep purple
    "#e64a19",  # deep orange
    "#afb42b",  # lime
    "#ff8f00",  # amber
]


# Mapping sémantique : couleur cohérente avec le sens de l'epic
SEMANTIC_COLORS: dict[str, str] = {
    "O50": "#1976d2",  # Bleu — Objectif 50% (eau, débit)
    "RDR": "#00897b",  # Teal — Respect des rejets (environnement)
    "FAB": "#c2185b",  # Rose — Fin antibio (santé)
    "NCL": "#2e7d32",  # Vert — Réduction alarmes (sérénité opérationnelle)
    "RIN": "#e64a19",  # Orange vif — Risque incendie
    "MAI": "#5f6368",  # Gris — Maintenance industrielle
    "EPR": "#ff8f00",  # Ambre — Entreprise profitable
    "EEF": "#0097a7",  # Cyan — Entreprise efficace
    "ERX": "#689f38",  # Vert clair — Entreprise relaxée
    "ESU": "#3f51b5",  # Indigo — Entreprise sûre
    "ENP": "#7b1fa2",  # Violet — ENP
    "ERE": "#afb42b",  # Lime — ERE
    "NPL": "#9e9e9e",  # Gris clair — Non planifié
    "TVS": "#512da8",  # Violet foncé — Transverse
}


def color_for(trigramme: str) -> str:
    if trigramme in SEMANTIC_COLORS:
        return SEMANTIC_COLORS[trigramme]
    h = sum(ord(c) for c in trigramme) % len(FALLBACK_PALETTE)
    return FALLBACK_PALETTE[h]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--api", default="http://localhost:8088")
    ap.add_argument("--force", action="store_true", help="Réécrire même si une couleur est déjà définie")
    args = ap.parse_args()

    epics = requests.get(f"{args.api}/api/epics", timeout=10).json()
    updated = 0
    skipped = 0
    for e in epics:
        new_color = color_for(e["trigramme"])
        if e.get("couleur") and not args.force:
            print(f"  - {e['trigramme']} : déjà {e['couleur']} (skip)")
            skipped += 1
            continue
        r = requests.put(
            f"{args.api}/api/epics/{e['trigramme']}",
            json={"couleur": new_color},
            timeout=10,
        )
        if r.status_code >= 400:
            print(f"  ! {e['trigramme']} : refusé ({r.status_code}) — {r.text[:120]}")
            continue
        print(f"  ✓ {e['trigramme']} ({e['nom'][:40]}) → {new_color}")
        updated += 1

    print(f"\nTerminé : {updated} mis à jour, {skipped} conservés.")


if __name__ == "__main__":
    sys.exit(main())
