import re
from typing import Annotated

from pydantic import AfterValidator, BaseModel, Field

from app.models.user import UserRole
from app.schemas.common import TimestampedRead

# On ne se sert PAS de `EmailStr` : email-validator (derrière) refuse les TLD
# réservés comme `.local` comme « special-use », sans réglage pour l'autoriser
# (vérifié, y compris test_environment=True). Or l'app en a besoin : l'import du
# classeur fabrique les adresses des chargés de projet sur un domaine interne
# (`prenom.nom@lesfontaines.local`), et un realm Keycloak local peut faire de
# même. On valide donc le format soi-même, en tolérant ces domaines.
# L'unicité (INV-AUTH-1) reste gérée côté route, insensible à la casse.
_EMAIL_RE = re.compile(r"^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$")


def _valider_email(v: str) -> str:
    v = v.strip()
    if not _EMAIL_RE.match(v):
        raise ValueError("Adresse email invalide")
    return v


Email = Annotated[str, AfterValidator(_valider_email)]


class UserCreate(BaseModel):
    """Compte créé *à l'avance*, avant toute connexion — sans mot de passe.

    Depuis Keycloak, un compte local n'est plus un moyen de s'authentifier : il
    sert de cible aux clés étrangères `responsable_id`. On en crée donc pour
    pouvoir affecter du travail à quelqu'un qui ne s'est pas encore connecté
    (c'est ce que fait l'import du classeur avec les chargés de projet).

    Le rapprochement se fait à la première connexion, PAR EMAIL : le compte est
    alors lié à son `keycloak_sub` (cf. `auth/provisioning.py`). D'où l'unique
    exigence ici — que l'email soit celui du realm.
    """

    nom: str = Field(min_length=1, max_length=200)
    email: Email
    role: UserRole = UserRole.membre
    actif: bool = True


class UserUpdate(BaseModel):
    """Champs modifiables localement.

    `role` et `email` sont RESYNCHRONISÉS depuis le jeton à chaque connexion :
    les modifier ici ne tient que jusqu'à la prochaine. Le levier durable est
    `actif`, que Keycloak n'écrase pas — c'est la révocation immédiate côté
    application.
    """

    nom: str | None = Field(default=None, min_length=1, max_length=200)
    email: Email | None = None
    role: UserRole | None = None
    actif: bool | None = None


class UserRead(TimestampedRead):
    id: int
    nom: str
    email: str
    role: UserRole
    actif: bool


class UserAnnuaire(BaseModel):
    """Vue minimale d'un utilisateur : de quoi remplir un sélecteur de responsable.

    Volontairement réduite à l'identifiant et au nom. Affecter un responsable
    n'exige pas de connaître les emails, les rôles ni les comptes désactivés —
    c'est ce qui permet d'ouvrir cette liste à tout membre tout en réservant
    l'annuaire complet (`GET /api/users`) aux administrateurs.
    """

    id: int
    nom: str

    model_config = {"from_attributes": True}
