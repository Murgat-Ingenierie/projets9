"""Claude — déposer une demande, qui devient une issue GitHub.

L'utilisateur remplit un formulaire (type, titre, description) ; l'API ouvre
l'issue, SANS label. La suite se joue sur GitHub, sous l'abonnement Claude Code :
Claude relit l'issue et pose ses questions en commentaire (`claude.yml`), un
humain la valide en posant « claude-fix », Claude code et ouvre une PR
(`claude-fix.yml`). Rien ne part en développement sans ce geste.

Une première version dialoguait ici même avec Haiku via l'API Messages. Retirée :
cette API se paie en crédits, distincts de l'abonnement — et le dialogue vit
aussi bien en commentaires d'issue, où il laisse une trace.

Sans jeton (`GITHUB_TOKEN`) la fonctionnalité est simplement absente : 503.
"""

from __future__ import annotations

import logging
import re
from typing import Literal

import requests
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.auth import get_current_user
from app.config import settings
from app.models.user import User

router = APIRouter(prefix="/api/claude", tags=["claude"])
log = logging.getLogger("claude")


class DemandeCreate(BaseModel):
    type: Literal["bug", "amelioration"]
    titre: str = Field(min_length=3, max_length=100)
    description: str = Field(min_length=10, max_length=5000)


class IssueCreee(BaseModel):
    number: int
    url: str


def _sans_mention(texte: str) -> str:
    """Neutralise les @mentions : un prénom tapé par l'utilisateur peut coïncider
    avec un vrai compte GitHub hors équipe, qui serait notifié à tort."""
    return re.sub(r"@(?=[a-z0-9_-])", "@​", texte, flags=re.IGNORECASE)


def _creer_issue(titre: str, corps: str) -> IssueCreee:
    """Isolée pour être remplacée dans les tests (aucun appel réseau en CI)."""
    r = requests.post(
        f"https://api.github.com/repos/{settings.github_repo}/issues",
        # Aucun label : le gate humain est le label « claude-fix », posé à la main.
        json={"title": titre, "body": corps, "labels": []},
        headers={
            "Authorization": f"Bearer {settings.github_token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        },
        timeout=15,
    )
    r.raise_for_status()
    d = r.json()
    return IssueCreee(number=d["number"], url=d["html_url"])


@router.post("/issues", response_model=IssueCreee, status_code=status.HTTP_201_CREATED)
def creer_demande(payload: DemandeCreate, me: User = Depends(get_current_user)) -> IssueCreee:
    if not settings.github_token:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Dépôt d'issues non configuré")

    prefixe = "Bug" if payload.type == "bug" else "Amélioration"
    titre = f"[{prefixe}] {payload.titre.strip()}"
    corps = (
        f"> Demande déposée depuis l'application par {_sans_mention(me.nom)}.\n\n"
        + _sans_mention(payload.description.strip())
    )
    try:
        return _creer_issue(titre, corps)
    except requests.RequestException as e:
        log.error("création d'issue échouée : %s", e)
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Création de l'issue impossible") from None
