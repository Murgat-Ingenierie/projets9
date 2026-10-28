import enum

from sqlalchemy import CheckConstraint, Enum, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base, TimestampMixin


class DependencyType(str, enum.Enum):
    FS = "FS"
    SS = "SS"
    FF = "FF"


class Dependency(Base, TimestampMixin):
    __tablename__ = "dependencies"
    __table_args__ = (
        CheckConstraint("tache_amont_id <> tache_aval_id", name="ck_dependency_no_self"),
        # Un prédécesseur et un seul : une tâche OU la fin d'un projet (#141).
        CheckConstraint(
            "(tache_amont_id IS NULL) <> (projet_amont_id IS NULL)",
            name="ck_dependency_amont_unique",
        ),
        # Un projet n'est prédécesseur que par sa FIN : c'est la demande, et c'est
        # la seule lecture sans ambiguïté — « le début d'un projet » n'est la fin
        # d'aucun travail à attendre.
        CheckConstraint(
            "projet_amont_id IS NULL OR type = 'FS'", name="ck_dependency_projet_fs"
        ),
        UniqueConstraint(
            "tache_amont_id", "tache_aval_id", "type", name="uq_dependency_amont_aval_type"
        ),
        # La contrainte ci-dessus ne voit pas les lignes à `tache_amont_id` NULL
        # (NULL n'est égal à rien) : il faut la sienne aux liens de projet.
        UniqueConstraint(
            "projet_amont_id", "tache_aval_id", name="uq_dependency_projet_aval"
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    # Exactement un des deux prédécesseurs est renseigné (ck_dependency_amont_unique).
    tache_amont_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=True, index=True
    )
    projet_amont_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=True, index=True
    )
    tache_aval_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False, index=True
    )
    type: Mapped[DependencyType] = mapped_column(
        Enum(DependencyType, name="dependency_type"),
        nullable=False,
        default=DependencyType.FS,
    )
    updated_by_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
