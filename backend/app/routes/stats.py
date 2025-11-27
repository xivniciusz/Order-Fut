from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta
from typing import Callable
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from .. import schemas
from ..database import get_session
from ..dependencies import get_current_user
from ..models import Event, EventType, Group, Match, MatchPlayer, Player, User

router = APIRouter(prefix="/stats", tags=["stats"])


def _get_group_for_user(db: Session, group_id: UUID, user_id: UUID) -> Group:
    group = db.query(Group).filter(Group.id == group_id, Group.user_id == user_id).first()
    if not group:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Grupo nao encontrado para este usuario.")
    return group


def _collect_event_counts(
    db: Session,
    group_id: UUID,
    year: int | None,
    column_selector: Callable[[Event], object],
    event_filter: Callable[[Event], object],
) -> dict[UUID, int]:
    query = (
        db.query(column_selector(Event), func.count(Event.id))
        .join(Match, Match.id == Event.match_id)
        .filter(Match.group_id == group_id)
        .filter(event_filter(Event))
    )
    if year:
        query = query.filter(func.date_part("year", Match.starts_at) == year)
    rows = query.group_by(column_selector(Event)).all()
    return {row[0]: int(row[1]) for row in rows if row[0] is not None}


def _collect_match_counts(db: Session, group_id: UUID, year: int | None) -> dict[UUID, int]:
    query = (
        db.query(MatchPlayer.player_id, func.count(func.distinct(MatchPlayer.match_id)))
        .join(Match, Match.id == MatchPlayer.match_id)
        .filter(Match.group_id == group_id, MatchPlayer.is_present.is_(True))
    )
    if year:
        query = query.filter(func.date_part("year", Match.starts_at) == year)
    rows = query.group_by(MatchPlayer.player_id).all()
    return {row[0]: int(row[1]) for row in rows}


def _build_ranking(
    values: dict[UUID, int],
    players_map: dict[UUID, Player],
    limit: int = 5,
) -> list[schemas.RankingEntry]:
    ordered = sorted(
        ((player_id, amount) for player_id, amount in values.items() if amount > 0 and player_id in players_map),
        key=lambda item: (-item[1], players_map[item[0]].nome.lower()),
    )
    top = ordered[:limit]
    return [
        schemas.RankingEntry(player_id=str(player_id), player_nome=players_map[player_id].nome, value=value)
        for player_id, value in top
    ]


def _format_month_label(moment: datetime) -> str:
    return moment.strftime("%b/%y").title()


@router.get("/group/{group_id}", response_model=schemas.GroupStatsResponse, status_code=status.HTTP_200_OK)
def group_stats(
    group_id: UUID,
    year: int | None = Query(default=None, ge=1900, le=2100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
) -> schemas.GroupStatsResponse:
    group = _get_group_for_user(db, group_id, current_user.id)

    players = (
        db.query(Player)
        .filter(Player.group_id == group.id)
        .order_by(Player.nome.asc())
        .all()
    )
    players_map = {player.id: player for player in players}

    year_rows = (
        db.query(func.date_part("year", Match.starts_at))
        .filter(Match.group_id == group.id)
        .distinct()
        .order_by(func.date_part("year", Match.starts_at).desc())
        .all()
    )
    available_years = [int(row[0]) for row in year_rows if row[0] is not None]

    period_goals = _collect_event_counts(
        db,
        group.id,
        year,
        lambda event: event.player_id,
        lambda event: event.player_id.isnot(None) & (event.tipo == EventType.GOAL),
    )
    period_assists = _collect_event_counts(
        db,
        group.id,
        year,
        lambda event: event.assist_player_id,
        lambda event: event.assist_player_id.isnot(None),
    )
    period_cards = _collect_event_counts(
        db,
        group.id,
        year,
        lambda event: event.player_id,
        lambda event: event.player_id.isnot(None) & (event.tipo == EventType.CARD),
    )
    period_matches = _collect_match_counts(db, group.id, year)

    total_goals = _collect_event_counts(
        db,
        group.id,
        None,
        lambda event: event.player_id,
        lambda event: event.player_id.isnot(None) & (event.tipo == EventType.GOAL),
    )
    total_assists = _collect_event_counts(
        db,
        group.id,
        None,
        lambda event: event.assist_player_id,
        lambda event: event.assist_player_id.isnot(None),
    )
    total_cards = _collect_event_counts(
        db,
        group.id,
        None,
        lambda event: event.player_id,
        lambda event: event.player_id.isnot(None) & (event.tipo == EventType.CARD),
    )
    total_matches = _collect_match_counts(db, group.id, None)

    if year:
        matches_period_total = int(
            db.query(func.count(Match.id))
            .filter(Match.group_id == group.id)
            .filter(func.date_part("year", Match.starts_at) == year)
            .scalar()
            or 0
        )
    else:
        matches_period_total = int(db.query(func.count(Match.id)).filter(Match.group_id == group.id).scalar() or 0)
    matches_all_time_total = int(db.query(func.count(Match.id)).filter(Match.group_id == group.id).scalar() or 0)

    players_stats = []
    for player in players:
        period_line = schemas.StatLine(
            goals=period_goals.get(player.id, 0),
            assists=period_assists.get(player.id, 0),
            cards=period_cards.get(player.id, 0),
            matches=period_matches.get(player.id, 0),
        )
        total_line = schemas.StatLine(
            goals=total_goals.get(player.id, 0),
            assists=total_assists.get(player.id, 0),
            cards=total_cards.get(player.id, 0),
            matches=total_matches.get(player.id, 0),
        )
        players_stats.append(
            schemas.PlayerStatSnapshot(
                player_id=str(player.id),
                nome=player.nome,
                numero_camisa=player.numero_camisa,
                posicao=player.posicao,
                period=period_line,
                all_time=total_line,
            )
        )

    rankings = schemas.RankingBlock(
        goals=_build_ranking(period_goals, players_map),
        assists=_build_ranking(period_assists, players_map),
        matches=_build_ranking(period_matches, players_map),
    )

    period_totals = schemas.StatLine(
        goals=sum(period_goals.values()),
        assists=sum(period_assists.values()),
        cards=sum(period_cards.values()),
        matches=matches_period_total,
    )
    all_time_totals = schemas.StatLine(
        goals=sum(total_goals.values()),
        assists=sum(total_assists.values()),
        cards=sum(total_cards.values()),
        matches=matches_all_time_total,
    )

    chart_limit = 6
    chart_match_query = (
        db.query(func.date_trunc("month", Match.starts_at).label("month"), func.count(Match.id))
        .select_from(Match)
        .filter(Match.group_id == group.id)
    )
    chart_goal_query = (
        db.query(func.date_trunc("month", Match.starts_at).label("month"), func.count(Event.id))
        .select_from(Match)
        .join(Event, Event.match_id == Match.id)
        .filter(Match.group_id == group.id, Event.tipo == EventType.GOAL)
    )
    if year:
        chart_match_query = chart_match_query.filter(func.date_part("year", Match.starts_at) == year)
        chart_goal_query = chart_goal_query.filter(func.date_part("year", Match.starts_at) == year)
    else:
        cutoff = datetime.utcnow() - timedelta(days=180)
        chart_match_query = chart_match_query.filter(Match.starts_at >= cutoff)
        chart_goal_query = chart_goal_query.filter(Match.starts_at >= cutoff)

    match_rows = chart_match_query.group_by("month").order_by("month").all()
    goal_rows = chart_goal_query.group_by("month").order_by("month").all()

    if not year and len(match_rows) > chart_limit:
        match_rows = match_rows[-chart_limit:]
    if not year and len(goal_rows) > chart_limit:
        goal_rows = goal_rows[-chart_limit:]

    goals_by_month = {row[0]: int(row[1]) for row in goal_rows}

    chart_points = [
        schemas.ChartPoint(
            label=_format_month_label(row[0]),
            goals=goals_by_month.get(row[0], 0),
            matches=int(row[1]),
        )
        for row in match_rows
    ]

    return schemas.GroupStatsResponse(
        group=schemas.SelectedGroup(id=str(group.id), nome=group.nome),
        filter_year=year,
        available_years=available_years,
        totals_period=period_totals,
        totals_all_time=all_time_totals,
        rankings=rankings,
        chart=chart_points,
        players=players_stats,
        generated_at=datetime.utcnow(),
    )


@router.get("/player/{player_id}", response_model=schemas.PlayerStatsResponse, status_code=status.HTTP_200_OK)
def player_stats(
    player_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
) -> schemas.PlayerStatsResponse:
    player = (
        db.query(Player)
        .join(Group, Group.id == Player.group_id)
        .filter(Player.id == player_id, Group.user_id == current_user.id)
        .first()
    )
    if not player:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Jogador nao encontrado para este usuario.")

    group = player.group

    def _count_events(filter_clause):
        return int(
            db.query(func.count(Event.id))
            .join(Match, Match.id == Event.match_id)
            .filter(Match.group_id == group.id)
            .filter(filter_clause)
            .scalar()
            or 0
        )

    totals = schemas.StatLine(
        goals=_count_events((Event.player_id == player.id) & (Event.tipo == EventType.GOAL)),
        assists=_count_events(Event.assist_player_id == player.id),
        cards=_count_events((Event.player_id == player.id) & (Event.tipo == EventType.CARD)),
        matches=int(
            db.query(func.count(func.distinct(MatchPlayer.match_id)))
            .filter(MatchPlayer.player_id == player.id, MatchPlayer.is_present.is_(True))
            .scalar()
            or 0
        ),
    )

    year_stats: dict[int, dict[str, int]] = defaultdict(lambda: {"goals": 0, "assists": 0, "cards": 0, "matches": 0})

    goal_rows = (
        db.query(func.date_part("year", Match.starts_at).label("year"), func.count(Event.id))
        .join(Match, Match.id == Event.match_id)
        .filter(Match.group_id == group.id, Event.player_id == player.id, Event.tipo == EventType.GOAL)
        .group_by("year")
        .all()
    )
    for year_value, count in goal_rows:
        if year_value is not None:
            year_stats[int(year_value)]["goals"] = int(count)

    assist_rows = (
        db.query(func.date_part("year", Match.starts_at).label("year"), func.count(Event.id))
        .join(Match, Match.id == Event.match_id)
        .filter(Match.group_id == group.id, Event.assist_player_id == player.id)
        .group_by("year")
        .all()
    )
    for year_value, count in assist_rows:
        if year_value is not None:
            year_stats[int(year_value)]["assists"] = int(count)

    card_rows = (
        db.query(func.date_part("year", Match.starts_at).label("year"), func.count(Event.id))
        .join(Match, Match.id == Event.match_id)
        .filter(Match.group_id == group.id, Event.player_id == player.id, Event.tipo == EventType.CARD)
        .group_by("year")
        .all()
    )
    for year_value, count in card_rows:
        if year_value is not None:
            year_stats[int(year_value)]["cards"] = int(count)

    match_rows = (
        db.query(func.date_part("year", Match.starts_at).label("year"), func.count(func.distinct(MatchPlayer.match_id)))
        .join(Match, Match.id == MatchPlayer.match_id)
        .filter(MatchPlayer.player_id == player.id, MatchPlayer.is_present.is_(True))
        .group_by("year")
        .all()
    )
    for year_value, count in match_rows:
        if year_value is not None:
            year_stats[int(year_value)]["matches"] = int(count)

    per_year = [
        schemas.PlayerYearBreakdown(
            year=year_key,
            totals=schemas.StatLine(
                goals=values["goals"],
                assists=values["assists"],
                cards=values["cards"],
                matches=values["matches"],
            ),
        )
        for year_key, values in sorted(year_stats.items(), reverse=True)
    ]

    recent_matches = (
        db.query(Match.id, Match.titulo, Match.starts_at)
        .join(MatchPlayer, MatchPlayer.match_id == Match.id)
        .filter(MatchPlayer.player_id == player.id, MatchPlayer.is_present.is_(True))
        .order_by(Match.starts_at.desc())
        .limit(8)
        .all()
    )
    match_ids = [row[0] for row in recent_matches]

    goal_match_map: dict[UUID, int] = {}
    assist_match_map: dict[UUID, int] = {}
    card_match_map: dict[UUID, int] = {}
    if match_ids:
        goal_match_map = {
            row[0]: int(row[1])
            for row in (
                db.query(Event.match_id, func.count(Event.id))
                .filter(Event.match_id.in_(match_ids), Event.player_id == player.id, Event.tipo == EventType.GOAL)
                .group_by(Event.match_id)
                .all()
            )
        }
        assist_match_map = {
            row[0]: int(row[1])
            for row in (
                db.query(Event.match_id, func.count(Event.id))
                .filter(Event.match_id.in_(match_ids), Event.assist_player_id == player.id)
                .group_by(Event.match_id)
                .all()
            )
        }
        card_match_map = {
            row[0]: int(row[1])
            for row in (
                db.query(Event.match_id, func.count(Event.id))
                .filter(Event.match_id.in_(match_ids), Event.player_id == player.id, Event.tipo == EventType.CARD)
                .group_by(Event.match_id)
                .all()
            )
        }

    recent = [
        schemas.PlayerMatchSnapshot(
            match_id=str(match_id),
            titulo=titulo,
            starts_at=starts_at,
            goals=goal_match_map.get(match_id, 0),
            assists=assist_match_map.get(match_id, 0),
            cards=card_match_map.get(match_id, 0),
        )
        for match_id, titulo, starts_at in recent_matches
    ]

    return schemas.PlayerStatsResponse(
        player=schemas.PlayerHeadline(
            id=str(player.id),
            nome=player.nome,
            numero_camisa=player.numero_camisa,
            posicao=player.posicao,
        ),
        group=schemas.SelectedGroup(id=str(group.id), nome=group.nome),
        totals=totals,
        per_year=per_year,
        recent_matches=recent,
    )
