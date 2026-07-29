"""Résolution de l'utilisateur courant — un seul chemin : Keycloak.

Avant ce chantier il y en avait trois : le mode débrayé (`AUTH_DISABLED`, qui
renvoyait le premier admin actif sans regarder le jeton), le JWT maison hérité,
et l'OIDC. Les deux premiers ont disparu avec le retrait de l'authentification
maison. Un seul chemin, c'est une seule chose à relire pour savoir qui entre.

Le mode débrayé méritait surtout de disparaître pour ce qu'il faisait en cas de
mauvaise configuration : il donnait des droits d'ADMINISTRATEUR sans jeton. Une
variable d'environnement oubliée à `true` suffisait à ouvrir l'application.
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.auth.oidc import decoder_jeton_oidc, endpoint_jeton
from app.auth.provisioning import utilisateur_depuis_jeton
from app.database import get_db
from app.models.user import User, UserRole

# `auto_error=False` : c'est nous qui levons le 401, avec un message en français
# cohérent avec le reste de l'API. L'URL sert la documentation OpenAPI (bouton
# « Authorize » de /api/docs) et pointe donc chez Keycloak, seul émetteur.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl=endpoint_jeton(), auto_error=False)


def get_current_user(
    token: str | None = Depends(oauth2_scheme), db: Session = Depends(get_db)
) -> User:
    if token is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token manquant")

    try:
        payload = decoder_jeton_oidc(token)
    except Exception:
        # Volontairement muet sur la cause (signature, expiration, audience) :
        # la distinction n'aide que celui qui cherche un jeton acceptable.
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Jeton invalide") from None

    return utilisateur_depuis_jeton(payload, db)


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != UserRole.admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Réservé aux administrateurs")
    return user
