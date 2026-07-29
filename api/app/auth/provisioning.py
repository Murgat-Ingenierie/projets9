"""Rapprochement d'un jeton Keycloak avec le compte local (C-Keycloak).

Keycloak fait autorité sur l'identité et les rôles ; la table `users` reste
néanmoins nécessaire, parce que `projects.responsable_id` et
`tasks.responsable_id` sont des clés étrangères vers `users.id`. Ce module fait
le pont, dans l'ordre retenu pour les applications du realm :

1. par `keycloak_sub` — l'identifiant **stable** ;
2. sinon par **email** — première connexion d'un compte préexistant, on le lie ;
3. sinon **création** du compte local.

Le rôle et l'email sont resynchronisés à chaque connexion : le compte local est
un *reflet* de Keycloak, pas une source parallèle. `users.role` reste donc
utilisable tel quel par `require_admin` et par l'écran `/users`.
"""

from __future__ import annotations

from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.auth.oidc import role_applicatif, roles_du_jeton
from app.config import settings
from app.invariants import InvariantError
from app.invariants.checks import check_max_active_users
from app.models.user import User


def utilisateur_depuis_jeton(payload: dict[str, Any], db: Session) -> User:
    sub = payload.get("sub")
    if not sub:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Jeton sans `sub`")

    roles = roles_du_jeton(payload, settings.keycloak_api_audience)
    role = role_applicatif(roles)
    if role is None:
        # L'utilisateur existe dans le realm mais n'a pas la porte d'entrée de
        # CETTE application. 403 et non 401 : il est authentifié, simplement pas
        # autorisé ici — se reconnecter n'y changerait rien.
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Compte sans accès à cette application (rôle `app-projets9-access` requis).",
        )

    email = (payload.get("email") or "").strip().lower()
    nom = payload.get("name") or payload.get("preferred_username") or email

    user = db.execute(select(User).where(User.keycloak_sub == sub)).scalar_one_or_none()

    if user is None:
        if not email:
            # Sans email on ne peut ni rapprocher ni créer : la colonne est NOT
            # NULL et unique. Mieux vaut le dire que d'inventer une adresse.
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                "Jeton sans email : impossible de rapprocher le compte local.",
            )
        # Compte préexistant (créé avant l'adossement, ou par l'import) : on le
        # lie à son `sub` à la première connexion OIDC.
        user = db.execute(select(User).where(User.email == email)).scalar_one_or_none()
        if user is not None:
            user.keycloak_sub = sub
        else:
            user = User(
                nom=nom,
                email=email,
                role=role,
                actif=True,
                keycloak_sub=sub,
            )
            actifs = db.execute(
                select(func.count()).select_from(User).where(User.actif)
            ).scalar_one()
            try:
                # +1 : le compte qu'on s'apprête à créer. Sans ce garde-fou, une
                # simple connexion pourrait franchir INV-AUTH-2 en douce.
                check_max_active_users(actifs + 1, limit=settings.max_active_users)
            except InvariantError as e:
                raise HTTPException(status.HTTP_403_FORBIDDEN, e.detail) from None
            db.add(user)

    if not user.actif:
        # Désactivé localement : on refuse, même si Keycloak l'accepte. C'est le
        # seul levier de révocation immédiate dont dispose l'application.
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Compte désactivé.")

    # Resynchronisation : Keycloak est la source de vérité.
    user.role = role
    if email:
        user.email = email
    if nom:
        user.nom = nom

    db.commit()
    db.refresh(user)
    return user
