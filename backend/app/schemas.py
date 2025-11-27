from __future__ import annotations

from datetime import datetime
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


class ActiveGroupSummary(BaseModel):
    id: str
    nome: str
    descricao: Optional[str] = None
    created_at: datetime
    total_players: int
    total_matches: int
    next_match: Optional[datetime] = None


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
