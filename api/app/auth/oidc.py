"""Adossement à Keycloak (realm renseigné par la configuration).

Deux moitiés bien séparées :

- **La logique pure** (`roles_du_jeton`, `role_applicatif`) — aucune E/S, donc
  testable sans Keycloak ni réseau. C'est elle qui porte les décisions.
- **La validation cryptographique** (`decoder_jeton_oidc`) — récupère les clés
  publiques du realm (JWKS) et vérifie signature, émetteur et audience.

Lecture HYBRIDE des rôles, `realm_access` **et** `resource_access[<audience>]`,
fusionnés. C'est la convention retenue dans le realm, et elle a une raison
précise : pendant une migration des rôles de *realm* vers *client*, un jeton peut
porter l'un, l'autre, ou les deux. Fusionner rend la bascule indolore — côté
Keycloak comme ici.
"""

from __future__ import annotations

from functools import lru_cache
from typing import Any

import jwt

from app.config import settings
from app.models.user import UserRole

#: Sans ce rôle, l'utilisateur existe dans le realm mais n'a rien à faire ici.
#: Convention `app-<projet>-access`, partagée avec les autres applications du realm.
ROLE_ACCES = "app-projets9-access"

#: Rôles applicatifs, tels que déclarés côté client Keycloak `projets9-api`.
ROLE_ADMIN = "admin"
ROLE_MEMBRE = "membre"


def roles_du_jeton(payload: dict[str, Any], audience: str) -> set[str]:
    """Rôles portés par le jeton : realm ET client, fusionnés (cf. docstring)."""
    realm = payload.get("realm_access", {}).get("roles", []) or []
    client = payload.get("resource_access", {}).get(audience, {}).get("roles", []) or []
    return {str(r) for r in [*realm, *client]}


def role_applicatif(roles: set[str]) -> UserRole | None:
    """Rôle applicatif déduit des rôles Keycloak.

    `None` = accès refusé : l'utilisateur n'a pas la porte d'entrée. On distingue
    bien « pas le droit d'entrer » (None) de « entre en simple membre »
    (UserRole.membre) — confondre les deux ouvrirait l'application à tout le realm.
    """
    if ROLE_ACCES not in roles:
        return None
    return UserRole.admin if ROLE_ADMIN in roles else UserRole.membre


def keycloak_configure() -> bool:
    """Vrai si l'adossement Keycloak est renseigné.

    Depuis le retrait de l'authentification maison, il n'y a plus de « sinon » :
    c'est une condition de démarrage, vérifiée par `app.main`, pas une bascule.
    """
    return bool(settings.keycloak_base_url and settings.keycloak_realm)


def issuer() -> str:
    base = settings.keycloak_base_url.rstrip("/")
    return f"{base}/realms/{settings.keycloak_realm}"


def endpoint_jeton() -> str:
    """Endpoint d'émission des jetons — pour la doc OpenAPI seulement.

    L'API n'émet plus de jeton depuis le retrait de `POST /api/auth/login` ; le
    bouton « Authorize » de `/api/docs` doit donc pointer chez Keycloak.
    """
    return f"{issuer()}/protocol/openid-connect/token"


@lru_cache(maxsize=1)
def _client_jwks() -> jwt.PyJWKClient:
    """Client JWKS mis en cache : les clés sont récupérées une fois, pas à chaque requête.

    `PyJWKClient` gère lui-même son cache interne et le renouvellement des clés
    (rotation côté Keycloak).
    """
    return jwt.PyJWKClient(f"{issuer()}/protocol/openid-connect/certs")


def decoder_jeton_oidc(token: str) -> dict[str, Any]:
    """Valide un jeton Keycloak : signature RS256, émetteur et audience.

    Lève une exception `jwt.*` si quoi que ce soit cloche — l'appelant traduit en
    401. On vérifie explicitement `iss` et `aud` : sans eux, un jeton valide émis
    pour une AUTRE application du même realm serait accepté ici.
    """
    cle = _client_jwks().get_signing_key_from_jwt(token)
    return jwt.decode(
        token,
        cle.key,
        algorithms=["RS256"],
        audience=settings.keycloak_api_audience,
        issuer=issuer(),
    )
