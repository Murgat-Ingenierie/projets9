from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models.task import Task
from app.models.todo import TaskTodo
from app.models.user import User
from app.schemas.todo import TodoCreate, TodoRead, TodoUpdate

router = APIRouter(prefix="/api/todos", tags=["todos"])

# Aucune de ces routes n'exige `require_admin`, y compris la suppression — seule
# exception aux neuf DELETE administrateurs de l'API, et c'est délibéré.
#
# Ce qui justifie la règle ailleurs est la PORTÉE : les clés étrangères sont en
# cascade sur toute la hiérarchie, donc supprimer un epic emporte ses projets,
# leurs tâches, et par ricochet dépendances, mesures et allocations. Un todo n'a
# rien en dessous de lui et n'est référencé par rien. Le supprimer n'emporte que
# lui-même.
#
# À quoi s'ajoute l'usage : c'est la liste qu'on coche EN FAISANT le travail. Une
# ligne mal saisie qu'on ne pourrait pas retirer sans passer par un administrateur
# rendrait l'outil pénible pour ce qu'il est censé servir.


def _tache_ou_404(db: Session, tache_id: int) -> Task:
    t = db.get(Task, tache_id)
    if t is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Tâche introuvable")
    return t


@router.get("", response_model=list[TodoRead])
def list_todos(
    tache_id: int | None = None,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
) -> list[TaskTodo]:
    # Ordre de création : la liste n'a pas de rang propre, cf. le modèle.
    q = select(TaskTodo).order_by(TaskTodo.id)
    if tache_id is not None:
        q = q.where(TaskTodo.tache_id == tache_id)
    return list(db.execute(q).scalars().all())


@router.post("", response_model=TodoRead, status_code=status.HTTP_201_CREATED)
def create_todo(
    payload: TodoCreate,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
) -> TaskTodo:
    _tache_ou_404(db, payload.tache_id)
    new = TaskTodo(**payload.model_dump(), updated_by_id=me.id)
    db.add(new)
    db.commit()
    db.refresh(new)
    return new


@router.put("/{todo_id}", response_model=TodoRead)
def update_todo(
    todo_id: int,
    payload: TodoUpdate,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
) -> TaskTodo:
    todo = db.get(TaskTodo, todo_id)
    if todo is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Todo introuvable")
    # `exclude_unset` : cocher une case n'envoie que `fait`, et ne doit pas
    # effacer le libellé au passage (même sémantique que la mise à jour d'un jalon).
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(todo, k, v)
    todo.updated_by_id = me.id
    db.commit()
    db.refresh(todo)
    return todo


@router.delete("/{todo_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_todo(
    todo_id: int,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
) -> None:
    todo = db.get(TaskTodo, todo_id)
    if todo is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Todo introuvable")
    db.delete(todo)
    db.commit()
