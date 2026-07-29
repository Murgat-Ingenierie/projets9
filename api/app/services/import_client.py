"""Adaptateur « en-process » pour l'import du classeur.

La logique d'import (`app/services/import_xlsx.py`) est écrite contre une
interface minuscule — `get(chemin, **params)` et `post(chemin, corps)` — héritée
de `scripts/import_data.py`, qui parlait à l'API en HTTP.

Ce module fournit la même interface **sans réseau** : chaque appel est dispatché
vers la **fonction de route correspondante**, appelée directement. C'est le point
essentiel : les invariants métier restent appliqués par le code qui les applique
déjà, on ne les réécrit pas. Une seconde implémentation des règles finirait par
diverger de la première — et c'est toujours la copie qui se trompe.

Les routes lèvent `HTTPException` quand un invariant refuse ; on la traduit en
`(code, corps)`, la forme que la logique d'import sait déjà interpréter. Une
ligne refusée est donc comptée et rapportée, jamais insérée en douce.
"""

from __future__ import annotations

import datetime as dt
from enum import Enum
from typing import Any

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.user import User
from app.routes import epics, milestones, projects, tasks, users
from app.schemas.epic import EpicCreate
from app.schemas.milestone import MilestoneCreate
from app.schemas.project import ProjectCreate
from app.schemas.task import TaskCreate
from app.schemas.user import UserCreate


def _valeur(v: Any) -> Any:
    """Reproduit ce que la sérialisation JSON aurait produit.

    Point de fidélité essentiel : en HTTP, une date arrive en chaîne ISO et un
    enum en chaîne. La logique d'import fait donc `date.fromisoformat(...)` sur
    ces champs. Un adaptateur qui renverrait les objets Python bruts la ferait
    échouer — l'imitation doit aller jusque-là.
    """
    if isinstance(v, (dt.date, dt.datetime)):
        return v.isoformat()
    if isinstance(v, Enum):
        return v.value
    return v


def _serialise(objet: Any) -> Any:
    """Modèle SQLAlchemy -> dict, comme le ferait la sérialisation HTTP."""
    if isinstance(objet, list):
        return [_serialise(o) for o in objet]
    if hasattr(objet, "__table__"):
        return {c.name: _valeur(getattr(objet, c.name)) for c in objet.__table__.columns}
    return objet


class ClientEnProcess:
    """Même surface que l'ancien client HTTP, sans passer par le réseau."""

    def __init__(self, db: Session, utilisateur: User) -> None:
        self.db = db
        self.utilisateur = utilisateur

    # --- lecture ---------------------------------------------------------

    def get(self, chemin: str, **params: Any) -> Any:
        u = self.utilisateur
        if chemin == "/api/epics":
            return _serialise(epics.list_epics(db=self.db, _=u))
        if chemin == "/api/projects":
            return _serialise(projects.list_projects(epic=params.get("epic"), db=self.db, _=u))
        if chemin == "/api/tasks":
            return _serialise(tasks.list_tasks(projet_id=params.get("projet_id"), db=self.db, _=u))
        if chemin == "/api/milestones":
            return _serialise(
                milestones.list_milestones(
                    project_id=params.get('project_id'), epic=params.get('epic'), db=self.db, _=u
                )
            )
        if chemin == "/api/users":
            return _serialise(users.list_users(db=self.db, _=u))
        raise ValueError(f"chemin non pris en charge par l'import : GET {chemin}")

    # --- écriture --------------------------------------------------------

    def post(self, chemin: str, json: dict) -> tuple[int, Any]:
        u = self.utilisateur
        try:
            if chemin == "/api/epics":
                return 201, _serialise(epics.create_epic(payload=EpicCreate(**json), db=self.db, me=u))
            if chemin == "/api/projects":
                return 201, _serialise(
                    projects.create_project(payload=ProjectCreate(**json), db=self.db, me=u)
                )
            if chemin == "/api/tasks":
                return 201, _serialise(tasks.create_task(payload=TaskCreate(**json), db=self.db, me=u))
            if chemin == "/api/milestones":
                return 201, _serialise(
                    milestones.create_milestone(payload=MilestoneCreate(**json), db=self.db, me=u)
                )
            if chemin == "/api/users":
                return 201, _serialise(users.create_user(payload=UserCreate(**json), db=self.db, me=u))
        except HTTPException as e:
            # Refus d'invariant (409) ou validation : même forme que la réponse
            # HTTP, pour que la logique d'import la traite sans savoir d'où elle
            # vient. La ligne est comptée comme refusée, avec son motif.
            return e.status_code, {"detail": e.detail}
        raise ValueError(f"chemin non pris en charge par l'import : POST {chemin}")
