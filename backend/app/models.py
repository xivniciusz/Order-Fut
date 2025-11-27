from __future__ import annotations

import hashlib
import secrets
import uuid
from datetime import datetime
from enum import Enum as PyEnum

from sqlalchemy import DateTime, Enum as SAEnum, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def default_uuid() -> uuid.UUID:
    return uuid.uuid4()


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=default_uuid)
    nome: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    senha_hash: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)

    reset_tokens: Mapped[list[PasswordResetToken]] = relationship(
        "PasswordResetToken",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    groups: Mapped[list["Group"]] = relationship("Group", back_populates="owner")


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=default_uuid)
    token_hash: Mapped[str] = mapped_column(String(128), unique=True, nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)

    user: Mapped[User] = relationship("User", back_populates="reset_tokens")

    @staticmethod
    def generate_token_pair() -> tuple[str, str]:
        raw_token = secrets.token_urlsafe(48)
        digest = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
        return raw_token, digest


class Group(Base):
    __tablename__ = "groups"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=default_uuid)
    nome: Mapped[str] = mapped_column(String(160), nullable=False)
    descricao: Mapped[str | None] = mapped_column(Text)
    owner_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    owner: Mapped[User] = relationship("User", back_populates="groups")
    players: Mapped[list["Player"]] = relationship("Player", back_populates="group", cascade="all, delete-orphan")
    matches: Mapped[list["Match"]] = relationship("Match", back_populates="group", cascade="all, delete-orphan")


class PlayerStatus(str, PyEnum):
    ACTIVE = "active"
    INACTIVE = "inactive"


class Player(Base):
    __tablename__ = "players"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=default_uuid)
    group_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("groups.id", ondelete="CASCADE"), index=True)
    nome: Mapped[str] = mapped_column(String(160), nullable=False)
    posicao: Mapped[str | None] = mapped_column(String(80))
    status: Mapped[PlayerStatus] = mapped_column(SAEnum(PlayerStatus), default=PlayerStatus.ACTIVE, nullable=False)
    numero_camisa: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

    group: Mapped[Group] = relationship("Group", back_populates="players")
    events: Mapped[list["Event"]] = relationship("Event", back_populates="player")


class MatchStatus(str, PyEnum):
    SCHEDULED = "scheduled"
    FINISHED = "finished"
    CANCELED = "canceled"


class Match(Base):
    __tablename__ = "matches"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=default_uuid)
    group_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("groups.id", ondelete="CASCADE"), index=True)
    titulo: Mapped[str] = mapped_column(String(160), nullable=False)
    local: Mapped[str | None] = mapped_column(String(200))
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[MatchStatus] = mapped_column(SAEnum(MatchStatus), default=MatchStatus.SCHEDULED, nullable=False)
    placar_pro: Mapped[int | None] = mapped_column(Integer)
    placar_contra: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

    group: Mapped[Group] = relationship("Group", back_populates="matches")
    events: Mapped[list["Event"]] = relationship("Event", back_populates="match", cascade="all, delete-orphan")


class EventType(str, PyEnum):
    GOAL = "goal"
    CARD = "card"
    ATTENDANCE = "attendance"


class Event(Base):
    __tablename__ = "events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=default_uuid)
    match_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("matches.id", ondelete="CASCADE"), index=True)
    player_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("players.id", ondelete="SET NULL"))
    tipo: Mapped[EventType] = mapped_column(SAEnum(EventType), nullable=False)
    valor: Mapped[float | None] = mapped_column(Float)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

    match: Mapped[Match] = relationship("Match", back_populates="events")
    player: Mapped[Player | None] = relationship("Player", back_populates="events")
