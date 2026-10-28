from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import get_current_user, require_admin
from app.database import get_db
from app.invariants import InvariantError
from app.invariants.checks import (
    check_dependency_acyclic,
    check_dependency_no_self,
)
from app.models.dependency import Dependency, DependencyType
from app.models.project import Project
from app.models.task import Task
from app.models.user import User
from app.routes.errors import http_from_invariant
from app.schemas.dependency import DependencyCreate, DependencyRead, DependencyUpdate

router = APIRouter(prefix="/api/dependencies", tags=["dependencies"])


def verifier_graphe(db: Session, new_edge: Dependency | None = None) -> None:
    """Rejoue INV-14 sur tout le graphe, liens de projet compris.

    Appelée aussi depuis `routes/tasks.py` : rattacher une tâche à un autre
    projet change les arêtes implicites tâche → fin de projet, et peut fermer un
    cycle sans qu'aucune dépendance n'ait été écrite.
    """
    existing = list(db.execute(select(Dependency)).scalars().all())
    taches_par_projet: dict[int, list[int]] = defaultdict(list)
    for tache_id, projet_id in db.execute(select(Task.id, Task.projet_id)).all():
        taches_par_projet[projet_id].append(tache_id)
    check_dependency_acyclic(existing, new_edge=new_edge, taches_par_projet=taches_par_projet)


@router.get("", response_model=list[DependencyRead])
def list_deps(
    db: Session = Depends(get_db), _=Depends(get_current_user)
) -> list[Dependency]:
    return list(db.execute(select(Dependency).order_by(Dependency.id)).scalars().all())


@router.post("", response_model=DependencyRead, status_code=status.HTTP_201_CREATED)
def create_dep(
    payload: DependencyCreate,
    db: Session = Depends(get_db),
    me: User = Depends(require_admin),
) -> Dependency:
    """Créer une dépendance — réservé aux administrateurs.

    La suppression l'était déjà (C7). L'asymétrie qui subsistait piégeait les
    membres : ils pouvaient tracer un lien sans pouvoir le retirer, et même le
    bouton « Annuler » du planning échouait, puisqu'il passe par un DELETE. On
    ferme donc la création plutôt que d'ouvrir la suppression — décision prise le
    2026-08-04, cf. INVENTAIRE R4.
    """
    if payload.projet_amont_id is not None:
        if db.get(Project, payload.projet_amont_id) is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Projet amont introuvable")
    elif db.get(Task, payload.tache_amont_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Tâche amont ou aval introuvable")
    if db.get(Task, payload.tache_aval_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Tâche amont ou aval introuvable")

    new = Dependency(
        tache_amont_id=payload.tache_amont_id,
        projet_amont_id=payload.projet_amont_id,
        tache_aval_id=payload.tache_aval_id,
        type=payload.type,
        updated_by_id=me.id,
    )

    try:
        check_dependency_no_self(new)
        verifier_graphe(db, new_edge=new)
    except InvariantError as e:
        raise http_from_invariant(e) from None

    db.add(new)
    db.commit()
    db.refresh(new)
    return new


@router.put("/{dep_id}", response_model=DependencyRead)
def update_dep(
    dep_id: int,
    payload: DependencyUpdate,
    db: Session = Depends(get_db),
    me: User = Depends(require_admin),
) -> Dependency:
    """Changer le type d'une dépendance — réservé aux administrateurs.

    Comblait un manque qui obligeait à SUPPRIMER puis RECRÉER pour passer une
    `FS` en `SS` : deux opérations, dont une destructive, là où il s'agit de
    corriger un libellé de liaison.

    Aucun invariant n'est rejoué, et c'est délibéré : INV-14 et INV-15 ne
    dépendent que des extrémités, que `DependencyUpdate` ne permet pas de
    toucher. Voir sa docstring — ouvrir ce schéma imposerait de les remettre.

    Le changement n'est pas cosmétique pour autant : seules les `FS` propagent la
    cascade du planning. Passer une dépendance en `SS` retire sa tâche aval des
    décalages automatiques.

    Un lien de projet reste `FS` : c'est la FIN du projet qui est attendue (#141),
    les autres types n'y ont pas de sens.
    """
    dep = db.get(Dependency, dep_id)
    if dep is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Dépendance introuvable")
    if dep.projet_amont_id is not None and payload.type != DependencyType.FS:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "Un projet ne précède une tâche que par sa fin (type FS)",
        )
    dep.type = payload.type
    dep.updated_by_id = me.id
    db.commit()
    db.refresh(dep)
    return dep


@router.delete("/{dep_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_dep(
    dep_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
) -> None:
    d = db.get(Dependency, dep_id)
    if d is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Dépendance introuvable")
    db.delete(d)
    db.commit()
