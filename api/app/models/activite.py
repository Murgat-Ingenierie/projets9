from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base, TimestampMixin


class TaskActivite(Base, TimestampMixin):
    """Entrée de journal sur une tâche : ce qui a été fait, quand, par qui.

    IMMUABLE. Aucune route ne la modifie — c'est ce qui en fait une trace plutôt
    qu'une note. « J'ai vissé les boulons », daté et signé, ne veut plus rien dire
    si on peut le réécrire après coup. La suppression existe (une saisie sur la
    mauvaise tâche, ça arrive) mais elle est réservée aux administrateurs : ouverte
    à tous, elle autoriserait la réécriture par contournement — supprimer puis
    republier.

    `auteur_nom` est une COPIE du nom au moment de l'écriture, à côté de
    `auteur_id`. Un journal dit qui a écrit, à cette date-là : renommer ou
    désactiver un compte ensuite ne doit pas réécrire l'histoire, ni laisser des
    entrées orphelines si le compte disparaît (`updated_by_id` n'est FK vers rien
    dans ce schéma, cf. INVENTAIRE §points de fragilité). L'identifiant reste pour
    l'attribution, le nom pour la lecture.
    """

    __tablename__ = "task_activites"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    tache_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False, index=True
    )
    texte: Mapped[str] = mapped_column(Text, nullable=False)
    auteur_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    auteur_nom: Mapped[str] = mapped_column(String(120), nullable=False)
