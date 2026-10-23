"""Claude — un assistant qui transforme une demande en issue GitHub.

L'utilisateur décrit un bug ou une idée en langage naturel ; Claude pose au
besoin une ou deux questions, puis appelle l'outil `creer_issue` : c'est ce
signal qui ouvre l'issue sur le dépôt. L'issue est créée SANS label — un humain
la relit et pose « claude-fix » pour lancer le développement (cf.
.github/workflows/claude-fix.yml). Rien ne part en développement sans ce geste.

Sans clé (`ANTHROPIC_API_KEY`) la fonctionnalité est simplement absente : 503.
La conversation vit côté navigateur (le client renvoie tout le fil à chaque
tour) — pas de table, pas de migration, et rien d'intime ne reste en base.
"""

from __future__ import annotations

import logging
import re
from typing import Literal

import anthropic
import requests
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.auth import get_current_user
from app.config import settings
from app.models.user import User

router = APIRouter(prefix="/api/claude", tags=["claude"])
log = logging.getLogger("claude")

# Haiku : tri rapide et bon marché, c'est un dialogue de clarification, pas une
# analyse. Effort bas pour les mêmes raisons.
MODELE = "claude-haiku-5-5"
MAX_TOURS = 24  # borne un client qui boucle
MAX_MESSAGE = 5000

SYSTEME = """Tu es l'assistant du gestionnaire de projet « Les Fontaines » (planning de pisciculture : epics, projets, tâches, jalons, dépendances, équipes). Tu dialogues en français avec un membre de l'équipe qui signale un bug ou demande une amélioration.

Ton objectif : transformer une demande floue en une issue claire, qu'un développeur peut traiter sans te relire.

Déroulé :
- Pose une à deux questions courtes si nécessaire (où dans l'application, étapes, résultat attendu vs obtenu). Jamais un interrogatoire, ne redemande pas ce qui est déjà dit.
- Reste concis et direct. Ne promets ni délai ni correctif.
- Dès que la demande est actionnable (souvent après une question, parfois aucune), appelle l'outil creer_issue. Si l'utilisateur te le demande, appelle-le immédiatement avec ce que tu as.

Dans creer_issue : titre court et explicite ; corps en markdown avec les sections « Résumé », « Étapes / contexte », « Résultat attendu »."""

OUTIL_ISSUE = {
    "name": "creer_issue",
    "description": "Crée l'issue GitHub une fois la demande suffisamment claire.",
    "input_schema": {
        "type": "object",
        "properties": {
            "titre": {"type": "string", "description": "Titre court, sans préfixe."},
            "corps": {
                "type": "string",
                "description": "Markdown : Résumé, Étapes / contexte, Résultat attendu.",
            },
            "type": {"type": "string", "enum": ["bug", "amelioration"]},
        },
        "required": ["titre", "corps", "type"],
        "additionalProperties": False,
    },
    "strict": True,
}


class Message(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=MAX_MESSAGE)


class ChatRequete(BaseModel):
    messages: list[Message] = Field(min_length=1, max_length=2 * MAX_TOURS)


class IssueCreee(BaseModel):
    number: int
    url: str


class ChatReponse(BaseModel):
    reply: str
    issue: IssueCreee | None = None


def _sans_mention(texte: str) -> str:
    """Neutralise les @mentions : un prénom tapé par l'utilisateur peut coïncider
    avec un vrai compte GitHub hors équipe, qui serait notifié à tort."""
    return re.sub(r"@(?=[a-z0-9_-])", "@​", texte, flags=re.IGNORECASE)


def _appeler_claude(messages: list[dict[str, str]]) -> anthropic.types.Message:
    """Un tour de conversation. Isolé pour être remplacé dans les tests."""
    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    return client.messages.create(
        model=MODELE,
        max_tokens=1024,
        system=SYSTEME,
        output_config={"effort": "low"},
        tools=[OUTIL_ISSUE],
        messages=messages,
    )


def _creer_issue(titre: str, corps: str) -> IssueCreee:
    """Isolée pour être remplacée dans les tests (aucun appel réseau en CI)."""
    r = requests.post(
        f"https://api.github.com/repos/{settings.github_repo}/issues",
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


@router.post("/chat", response_model=ChatReponse)
def chat(payload: ChatRequete, me: User = Depends(get_current_user)) -> ChatReponse:
    if not settings.anthropic_api_key or not settings.github_token:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Assistant Claude non configuré")
    if payload.messages[-1].role != "user":
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Le dernier message doit venir de l'utilisateur")

    try:
        reponse = _appeler_claude([m.model_dump() for m in payload.messages])
    except anthropic.RateLimitError:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Assistant saturé, réessayer dans un instant") from None
    except (anthropic.APIStatusError, anthropic.APIConnectionError) as e:
        log.error("appel Claude échoué : %s", e)
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Assistant injoignable") from None

    reply = "\n".join(b.text for b in reponse.content if b.type == "text").strip()
    outil = next((b for b in reponse.content if b.type == "tool_use"), None)
    if outil is None:
        return ChatReponse(reply=reply)

    prefixe = "Bug" if outil.input["type"] == "bug" else "Amélioration"
    titre = f"[{prefixe}] {outil.input['titre']}"[:120]
    corps = (
        f"> Demande déposée depuis l'application par {_sans_mention(me.nom)}.\n\n"
        + _sans_mention(outil.input["corps"])
    )
    try:
        issue = _creer_issue(titre, corps)
    except requests.RequestException as e:
        log.error("création d'issue échouée : %s", e)
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Création de l'issue impossible") from None

    return ChatReponse(
        reply=reply or f"C'est noté : l'issue #{issue.number} est ouverte, l'équipe la relira.",
        issue=issue,
    )
