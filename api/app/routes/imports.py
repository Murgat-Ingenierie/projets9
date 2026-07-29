"""Import du classeur source depuis l'application (SPEC §4 — écran Paramètres).

Remplace `scripts/import_data.py` en tant que chemin nominal : le script
s'authentifiait par email/mot de passe sur le login maison, qui disparaît avec
l'adossement à Keycloak. Déposer le fichier depuis une page déjà authentifiée
règle le problème sans inventer de service account.

**Les invariants s'appliquent exactement comme avant** : l'import n'écrit pas en
base directement, il appelle les fonctions de route (cf. `ClientEnProcess`). Une
ligne invalide est refusée et rapportée — pas insérée en douce.

Réservé aux administrateurs : un import touche l'ensemble du planning.
"""

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth import require_admin
from app.database import get_db
from app.models.user import User
from app.services.import_client import ClientEnProcess
from app.services.import_xlsx import importer_classeur

router = APIRouter(prefix="/api/import", tags=["import"])

#: Garde-fou : un classeur de planning pèse quelques dizaines de Ko. Au-delà,
#: c'est un autre fichier — inutile de le charger en mémoire pour s'en rendre
#: compte. (Le proxy limite déjà à 16 Mo ; ceci est la limite métier.)
TAILLE_MAX = 5 * 1024 * 1024


class RapportRead(BaseModel):
    utilisateurs_crees: int
    projets_crees: int
    projets_deja_presents: int
    projets_non_planifies: int
    taches_creees: int
    taches_deja_presentes: int
    taches_sans_projet: int
    jalons: str
    refus: list[str]
    totaux: dict[str, int]


@router.post("/xlsx", response_model=RapportRead)
async def importer_xlsx(
    fichier: UploadFile = File(...),
    db: Session = Depends(get_db),
    me: User = Depends(require_admin),
) -> RapportRead:
    if not (fichier.filename or "").lower().endswith(".xlsx"):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Format attendu : un classeur .xlsx (export du Google Sheets source).",
        )

    contenu = await fichier.read()
    if len(contenu) > TAILLE_MAX:
        raise HTTPException(
            status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            f"Fichier trop volumineux ({len(contenu) // 1024} Ko) — limite {TAILLE_MAX // 1024} Ko.",
        )
    if not contenu:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Fichier vide.")

    try:
        rapport = importer_classeur(contenu, ClientEnProcess(db, me))
    except ValueError as e:
        # Classeur illisible ou onglets manquants : c'est une erreur de l'appelant
        # (mauvais fichier), pas du serveur. Le message dit lequel.
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e)) from None

    return RapportRead(**rapport.__dict__)
