"""Sauvegardes — SPEC §4, écran 11 : « déclencher un dump, voir l'historique ».

Deux décisions de conception, délibérées :

1. **L'API ne fabrique pas les dumps.** Elle n'a ni `pg_dump` ni la logique
   durcie de `docker/backup/backup.sh` (pipefail, écriture en `.part` renommée,
   `gzip -t`, rétention à plancher). Pour déclencher, elle dépose un fichier
   *sentinelle* dans un petit volume d'échange ; le conteneur `backup` le voit,
   exécute le script existant, puis retire la sentinelle. Aucun sous-processus,
   aucun client Postgres à embarquer, aucune duplication de logique.

2. **Pas de téléchargement.** Un endpoint qui renvoie un dump serait un chemin
   d'exfiltration complet de la base — d'autant que l'authentification est
   aujourd'hui périmétrique (VHost). Le volume est monté en LECTURE SEULE côté
   API : on liste, on demande, on ne récupère ni ne supprime. Le restore reste
   en ligne de commande (`docs/RESTORE.md`).
"""

from datetime import UTC, datetime
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.auth import require_admin
from app.config import settings

router = APIRouter(prefix="/api/backups", tags=["backups"])

# Nom du fichier sentinelle. Unique et fixe : plusieurs demandes rapprochées se
# fondent en une seule exécution, ce qui est le comportement voulu (inutile
# d'empiler des dumps identiques).
TRIGGER_NAME = "backup.request"

# Les dumps produits par backup.sh : "<base>_<horodatage>.sql.gz".
BACKUP_GLOB = "*.sql.gz"


class BackupFile(BaseModel):
    nom: str
    taille_octets: int
    """Date de dernière modification, en UTC ISO-8601."""
    date: datetime


class BackupRequestAccepted(BaseModel):
    demande: bool
    detail: str


@router.get("", response_model=list[BackupFile])
def list_backups(_=Depends(require_admin)) -> list[BackupFile]:
    """Historique des sauvegardes, la plus récente d'abord."""
    directory = Path(settings.backup_dir)
    if not directory.is_dir():
        # Volume non monté (ex. exécution hors Docker) : pas une erreur serveur,
        # simplement aucun historique à montrer.
        return []

    out: list[BackupFile] = []
    for f in directory.glob(BACKUP_GLOB):
        if not f.is_file():
            continue
        st = f.stat()
        out.append(
            BackupFile(
                nom=f.name,
                taille_octets=st.st_size,
                date=datetime.fromtimestamp(st.st_mtime, tz=UTC),
            )
        )
    out.sort(key=lambda b: b.date, reverse=True)
    return out


@router.post("", response_model=BackupRequestAccepted, status_code=status.HTTP_202_ACCEPTED)
def request_backup(_=Depends(require_admin)) -> BackupRequestAccepted:
    """Demande un dump au conteneur `backup` (asynchrone).

    202 et non 201 : à ce stade rien n'est encore écrit — le dump est seulement
    demandé. Le résultat apparaîtra dans l'historique une fois terminé.
    """
    trigger_dir = Path(settings.backup_trigger_dir)
    try:
        trigger_dir.mkdir(parents=True, exist_ok=True)
        (trigger_dir / TRIGGER_NAME).write_text(
            datetime.now(UTC).isoformat(), encoding="utf-8"
        )
    except OSError as e:
        # Volume d'échange absent ou non inscriptible : le dire franchement
        # plutôt que de laisser croire que la sauvegarde est lancée.
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Le service de sauvegarde est injoignable ({e.strerror}).",
        ) from e

    return BackupRequestAccepted(
        demande=True,
        detail="Sauvegarde demandée. Elle apparaîtra dans l'historique une fois terminée.",
    )
