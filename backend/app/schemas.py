from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, EmailStr, Field


class UserBase(BaseModel):
    nome: str
    email: EmailStr

    class Config:
        from_attributes = True


class UserPublic(UserBase):
    id: str
    created_at: datetime


class RegisterRequest(BaseModel):
    nome: str = Field(min_length=3, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8)
    confirm_password: str = Field(min_length=8)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    password: str = Field(min_length=8)
    confirm_password: str = Field(min_length=8)


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class AuthResponse(TokenPair):
    user: UserPublic


class MessageResponse(BaseModel):
    message: str
    detail: Optional[str] = None


class PlayerPosition(str, Enum):
    GK = "GK"
    DEF = "DEF"
    MID = "MID"
    ATT = "ATT"


class PlayerBase(BaseModel):
    nome: str = Field(min_length=3, max_length=160)
    posicao: PlayerPosition
    numero_camisa: Optional[int] = Field(default=None, ge=0, le=99)


class PlayerCreate(PlayerBase):
    group_id: str


class PlayerUpdate(BaseModel):
    nome: Optional[str] = Field(default=None, min_length=3, max_length=160)
    posicao: Optional[PlayerPosition] = None
    numero_camisa: Optional[int] = Field(default=None, ge=0, le=99)
    group_id: Optional[str] = None


class PlayerResponse(BaseModel):
    id: str
    group_id: str
    nome: str
    posicao: PlayerPosition
    numero_camisa: Optional[int]
    created_at: datetime


class PlayersListResponse(BaseModel):
    players: list[PlayerResponse]


class GroupBase(BaseModel):
    nome: str = Field(min_length=3, max_length=160)
    ano_base: Optional[int] = Field(default=None, ge=1900, le=2100)
    descricao: Optional[str] = Field(default=None, max_length=500)


class GroupCreate(GroupBase):
    pass


class GroupUpdate(BaseModel):
    nome: Optional[str] = Field(default=None, min_length=3, max_length=160)
    ano_base: Optional[int] = Field(default=None, ge=1900, le=2100)
    descricao: Optional[str] = Field(default=None, max_length=500)


class GroupResponse(BaseModel):
    id: str
    nome: str
    ano_base: Optional[int]
    descricao: Optional[str]
    is_active: bool
    created_at: datetime
    players_count: int


class GroupsListResponse(BaseModel):
    groups: list[GroupResponse]


class ActiveGroupSummary(BaseModel):
    id: str
    nome: str
    descricao: Optional[str] = None
    ano_base: Optional[int] = None
    created_at: datetime
    total_players: int
    total_matches: int
    next_match: Optional[datetime] = None
    is_active: bool


class ActiveGroupsResponse(BaseModel):
    groups: list[ActiveGroupSummary]


class StatsTotals(BaseModel):
    players: int
    matches: int
    goals: int
    cards: int
    attendance_entries: int


class SelectedGroup(BaseModel):
    id: str
    nome: str


class RecentMatchSummary(BaseModel):
    id: str
    titulo: str
    status: str
    starts_at: datetime
    placar_pro: Optional[int]
    placar_contra: Optional[int]


class TopScorer(BaseModel):
    player_id: str
    player_nome: str
    goals: int


class StatsOverviewResponse(BaseModel):
    group: SelectedGroup
    totals: StatsTotals
    recent_matches: list[RecentMatchSummary]
    top_scorers: list[TopScorer]
