from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import get_current_user, require_admin
from app.database import get_db
from app.models.activite import TaskActivite
from app.models.task import Task
from app.models.user import User
from app.schemas.activite import ActiviteCreate, ActiviteRead

router = APIRouter(prefix="/api/activites", tags=["activites"])

# PAS de route PUT, et c'est le cœur du sujet : une entrée de journal ne se
# modifie pas. « J'ai vissé les boulons », daté et signé, ne veut plus rien dire
# si on peut le réécrire après coup. Le schéma de mise à jour n'existe pas non
# plus — l'écrire par distraction demanderait de le créer d'abord.
#
# La suppression, elle, existe : une saisie sur la mauvaise tâche, ça arrive. Mais
# elle est réservée aux ADMINISTRATEURS. Ouverte à tous, elle rendrait
# l'immuabilité illusoire — il suffirait de supprimer puis republier. C'est le
# choix INVERSE de celui fait pour les todos, pour la raison inverse : là c'est du
# travail en cours, ici c'est une trace.


@router.get("", response_model=list[ActiviteRead])
def list_activites(
    tache_id: int | None = None,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
) -> list[TaskActivite]:
    # Plus RÉCENT d'abord : on ouvre une tâche pour savoir où elle en est, pas
    # pour relire son histoire depuis le début. Le journal n'a pas de fin.
    q = select(TaskActivite).order_by(TaskActivite.id.desc())
    if tache_id is not None:
        q = q.where(TaskActivite.tache_id == tache_id)
    return list(db.execute(q).scalars().all())


@router.post("", response_model=ActiviteRead, status_code=status.HTTP_201_CREATED)
def create_activite(
    payload: ActiviteCreate,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
) -> TaskActivite:
    if db.get(Task, payload.tache_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Tâche introuvable")
    # La signature est prise du JETON, jamais du corps de la requête : laisser le
    # client la fournir permettrait d'écrire au nom d'un autre.
    new = TaskActivite(
        tache_id=payload.tache_id,
        texte=payload.texte,
        auteur_id=me.id,
        auteur_nom=me.nom,
    )
    db.add(new)
    db.commit()
    db.refresh(new)
    return new


@router.delete("/{activite_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_activite(
    activite_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
) -> None:
    a = db.get(TaskActivite, activite_id)
    if a is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Entrée introuvable")
    db.delete(a)
    db.commit()
