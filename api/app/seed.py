"""Peuple la base au premier démarrage.

- Crée l'admin initial s'il n'existe pas.
- Importe le CSV des epics s'il est présent et que la table est vide.

Idempotent : si les données existent déjà, ne fait rien.
"""

from __future__ import annotations

import csv
import logging
import os
import re
import unicodedata
from pathlib import Path

from sqlalchemy import select

from app.auth.security import hash_password
from app.config import settings
from app.database import SessionLocal
from app.models.epic import Epic, EpicCategory, EpicStatus
from app.models.user import User, UserRole

log = logging.getLogger("seed")
logging.basicConfig(level=logging.INFO, format="%(levelname)s [seed] %(message)s")


def _slug(s: str) -> str:
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "_", s).strip("_")


# Catégorisation des epics issus du CSV initial (best effort).
# Si le mapping ne couvre pas un trigramme, on retombe sur "operationnel".
_CATEGORY_BY_TRIGRAMME: dict[str, EpicCategory] = {
    "O50": EpicCategory.operationnel,
    "RDR": EpicCategory.operationnel,
    "FAB": EpicCategory.operationnel,
    "NCL": EpicCategory.operationnel,
    "RIN": EpicCategory.operationnel,
    "MAI": EpicCategory.operationnel,
    "EPR": EpicCategory.strategique,
    "EEF": EpicCategory.strategique,
    "ERX": EpicCategory.strategique,
    "ESU": EpicCategory.strategique,
}


def _ensure_admin() -> None:
    with SessionLocal() as db:
        existing = db.execute(
            select(User).where(User.email == settings.seed_admin_email)
        ).scalar_one_or_none()
        if existing is not None:
            log.info("Admin déjà présent (%s)", existing.email)
            return
        admin = User(
            nom=settings.seed_admin_name,
            email=settings.seed_admin_email,
            password_hash=hash_password(settings.seed_admin_password),
            role=UserRole.admin,
            actif=True,
        )
        db.add(admin)
        db.commit()
        log.info("Admin créé : %s", admin.email)


def _ensure_epics_from_csv() -> None:
    path = Path(settings.seed_csv_path)
    if not path.exists():
        log.info("Pas de CSV à %s — skip", path)
        return

    with SessionLocal() as db:
        if db.execute(select(Epic).limit(1)).scalar_one_or_none() is not None:
            log.info("Epics déjà présents — skip CSV")
            return

        created = 0
        with path.open(encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                trigramme = (row.get("Trigramme de l'epic") or "").strip().upper()
                nom = (row.get("Nom du projet") or "").strip()
                if not trigramme or not nom:
                    continue
                if not re.match(r"^[A-Z0-9]{3}$", trigramme):
                    log.warning("Trigramme invalide ignoré : %r", trigramme)
                    continue
                if db.get(Epic, trigramme) is not None:
                    continue
                critere = (row.get("Critère de reussite") or "").strip() or None
                raison = (row.get("Raison de la date de fin") or "").strip() or None
                statut = EpicStatus.actif if critere else EpicStatus.idee
                epic = Epic(
                    trigramme=trigramme,
                    nom=nom,
                    critere_reussite=critere,
                    raison_date_fin=raison,
                    date_fin_prevue=None,
                    jalon_fin_max=None,
                    statut=statut,
                    categorie=_CATEGORY_BY_TRIGRAMME.get(
                        trigramme, EpicCategory.operationnel
                    ),
                )
                db.add(epic)
                created += 1
        db.commit()
        log.info("Epics importés depuis le CSV : %d", created)


def main() -> None:
    log.info("DATABASE_URL=%s", os.environ.get("DATABASE_URL", "<from .env>"))
    _ensure_admin()
    _ensure_epics_from_csv()


if __name__ == "__main__":
    main()
