from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from .. import schemas
from ..database import get_session
from ..dependencies import get_current_user
from ..models import Event, EventType, Group, Match, MatchStatus, Player, User

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/groups/active", response_model=schemas.ActiveGroupsResponse, status_code=status.HTTP_200_OK)
def list_active_groups(current_user: User = Depends(get_current_user), db: Session = Depends(get_session)) -> schemas.ActiveGroupsResponse:
    groups = (
        db.query(Group)
        .filter(Group.owner_id == current_user.id)
        .order_by(Group.created_at.asc())
        .all()
    )
    if not groups:
        return schemas.ActiveGroupsResponse(groups=[])

    group_ids = [group.id for group in groups]

    player_counts = {
        row[0]: row[1]
        for row in (
            db.query(Player.group_id, func.count(Player.id))
            .filter(Player.group_id.in_(group_ids))
            .group_by(Player.group_id)
            .all()
        )
    }
    match_counts = {
        row[0]: row[1]
        for row in (
            db.query(Match.group_id, func.count(Match.id))
            .filter(Match.group_id.in_(group_ids))
            .group_by(Match.group_id)
            .all()
        )
    }
    next_match_map = {
        row[0]: row[1]
        for row in (
            db.query(Match.group_id, func.min(Match.starts_at))
            .filter(Match.group_id.in_(group_ids))
            .filter(Match.status == MatchStatus.SCHEDULED)
            .group_by(Match.group_id)
            .all()
        )
    }

    summaries = []
    for group in groups:
        summaries.append(
            schemas.ActiveGroupSummary(
                id=str(group.id),
                nome=group.nome,
                descricao=group.descricao,
                created_at=group.created_at,
                total_players=int(player_counts.get(group.id, 0)),
                total_matches=int(match_counts.get(group.id, 0)),
                next_match=next_match_map.get(group.id),
            )
        )

    return schemas.ActiveGroupsResponse(groups=summaries)


@router.get("/stats/overview", response_model=schemas.StatsOverviewResponse, status_code=status.HTTP_200_OK)
def stats_overview(
    group_id: UUID | None = Query(default=None, description="Opcional: filtra por um grupo especifico"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
) -> schemas.StatsOverviewResponse:
    group_query = db.query(Group).filter(Group.owner_id == current_user.id)
    if group_id:
        group_query = group_query.filter(Group.id == group_id)

    group = group_query.order_by(Group.created_at.asc()).first()
    if not group:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Grupo nao encontrado para este usuario.")

    total_players = int(db.query(func.count(Player.id)).filter(Player.group_id == group.id).scalar() or 0)
    total_matches = int(db.query(func.count(Match.id)).filter(Match.group_id == group.id).scalar() or 0)

    event_counts = {
        row[0]: row[1]
        for row in (
            db.query(Event.tipo, func.count(Event.id))
            .join(Match, Match.id == Event.match_id)
            .filter(Match.group_id == group.id)
            .group_by(Event.tipo)
            .all()
        )
    }
    goals = int(event_counts.get(EventType.GOAL, 0))
    cards = int(event_counts.get(EventType.CARD, 0))
    attendance_entries = int(event_counts.get(EventType.ATTENDANCE, 0))

    recent_matches = (
        db.query(Match)
        .filter(Match.group_id == group.id)
        .order_by(Match.starts_at.desc())
        .limit(5)
        .all()
    )

    top_scorers_rows = (
        db.query(Player.id, Player.nome, func.count(Event.id).label("goals"))
        .join(Event, Event.player_id == Player.id)
        .join(Match, Match.id == Event.match_id)
        .filter(Match.group_id == group.id, Event.tipo == EventType.GOAL)
        .group_by(Player.id, Player.nome)
        .order_by(func.count(Event.id).desc(), Player.nome.asc())
        .limit(5)
        .all()
    )

    return schemas.StatsOverviewResponse(
        group=schemas.SelectedGroup(id=str(group.id), nome=group.nome),
        totals=schemas.StatsTotals(
            players=total_players,
            matches=total_matches,
            goals=goals,
            cards=cards,
            attendance_entries=attendance_entries,
        ),
        recent_matches=[
            schemas.RecentMatchSummary(
                id=str(match.id),
                titulo=match.titulo,
                status=match.status.value,
                starts_at=match.starts_at,
                placar_pro=match.placar_pro,
                placar_contra=match.placar_contra,
            )
            for match in recent_matches
        ],
        top_scorers=[
            schemas.TopScorer(player_id=str(row[0]), player_nome=row[1], goals=int(row[2])) for row in top_scorers_rows
        ],
    )
