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


class StatLine(BaseModel):
    goals: int
    assists: int
    cards: int
    matches: int


class RankingEntry(BaseModel):
    player_id: str
    player_nome: str
    value: int


class RankingBlock(BaseModel):
    goals: list[RankingEntry]
    assists: list[RankingEntry]
    matches: list[RankingEntry]


class StatsOverviewResponse(BaseModel):
    group: SelectedGroup
    totals: StatsTotals
    recent_matches: list[RecentMatchSummary]
    top_scorers: list[TopScorer]


class MatchDetailPlayer(BaseModel):
    match_player_id: str
    player_id: str
    nome: str
    is_goalkeeper: bool
    is_present: bool
    team_number: Optional[int]
    order_position: int


class MatchDetailResponse(BaseModel):
    id: str
    group_id: str
    titulo: str
    starts_at: datetime
    status: str
    team_size: int
    goalkeepers_fixed: bool
    created_at: datetime
    finished_at: Optional[datetime]
    teams: dict[str, list[MatchDetailPlayer]]
    bench: list[MatchDetailPlayer]
    events: list["EventResponse"]


class MatchCreateRequest(BaseModel):
    group_id: str
    titulo: str = Field(min_length=3, max_length=160)
    starts_at: datetime
    local: Optional[str] = Field(default=None, max_length=200)
    team_size: int = Field(default=5, ge=2, le=11)
    goalkeepers_fixed: bool = False


class MatchResponse(BaseModel):
    id: str
    group_id: str
    titulo: str
    starts_at: datetime
    local: Optional[str]
    team_size: int
    goalkeepers_fixed: bool
    created_at: datetime


class MatchPlayerSync(BaseModel):
    player_id: str
    is_present: bool
    is_goalkeeper: bool = False
    order_position: int = Field(ge=0, le=999)


class MatchPlayersSyncRequest(BaseModel):
    players: list[MatchPlayerSync]


class GenerateTeamsRequest(BaseModel):
    team_size: Optional[int] = Field(default=None, ge=2, le=11)
    goalkeepers_fixed: Optional[bool] = None


class GeneratedTeamPlayer(BaseModel):
    match_player_id: str
    player_id: str
    nome: str
    is_goalkeeper: bool
    order_position: int


class GeneratedTeam(BaseModel):
    team_number: int
    players: list[GeneratedTeamPlayer]


class GenerateTeamsResponse(BaseModel):
    teams: list[GeneratedTeam]
    bench: list[GeneratedTeamPlayer]


class EventType(str, Enum):
    GOAL = "goal"
    CARD = "card"
    ATTENDANCE = "attendance"
    ASSIST = "assist"
    SUBSTITUTION = "substitution"


class EventCreateRequest(BaseModel):
    match_id: str
    tipo: EventType
    player_id: Optional[str] = None
    assist_player_id: Optional[str] = None
    description: Optional[str] = Field(default=None, max_length=255)


class EventResponse(BaseModel):
    id: str
    match_id: str
    tipo: EventType
    player_id: Optional[str]
    player_nome: Optional[str]
    assist_player_id: Optional[str]
    assist_player_nome: Optional[str]
    description: Optional[str]
    created_at: datetime


class NextTeamRequest(BaseModel):
    team_number: int = Field(ge=1, le=2)


class FinishMatchResponse(BaseModel):
    id: str
    status: str
    finished_at: datetime


class PlayerHeadline(BaseModel):
    id: str
    nome: str
    numero_camisa: Optional[int]
    posicao: Optional[str]


class PlayerStatSnapshot(BaseModel):
    player_id: str
    nome: str
    numero_camisa: Optional[int]
    posicao: Optional[str]
    period: StatLine
    all_time: StatLine


class ChartPoint(BaseModel):
    label: str
    goals: int
    matches: int


class GroupStatsResponse(BaseModel):
    group: SelectedGroup
    filter_year: Optional[int]
    available_years: list[int]
    totals_period: StatLine
    totals_all_time: StatLine
    rankings: RankingBlock
    chart: list[ChartPoint]
    players: list[PlayerStatSnapshot]
    generated_at: datetime


class PlayerYearBreakdown(BaseModel):
    year: int
    totals: StatLine


class PlayerMatchSnapshot(BaseModel):
    match_id: str
    titulo: str
    starts_at: datetime
    goals: int
    assists: int
    cards: int


class PlayerStatsResponse(BaseModel):
    player: PlayerHeadline
    group: SelectedGroup
    totals: StatLine
    per_year: list[PlayerYearBreakdown]
    recent_matches: list[PlayerMatchSnapshot]
