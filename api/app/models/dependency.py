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
        UniqueConstraint(
            "tache_amont_id", "tache_aval_id", "type", name="uq_dependency_amont_aval_type"
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    tache_amont_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False, index=True
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
