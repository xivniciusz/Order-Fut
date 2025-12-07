from __future__ import annotations

from datetime import datetime
from typing import Optional
import math
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, aliased

from .. import schemas
from ..database import get_session
from ..dependencies import get_current_user
from ..models import Event, EventType as ModelEventType, Group, Match, MatchPlayer, MatchStatus, Player, User

router = APIRouter(prefix="/matches", tags=["matches"])
events_router = APIRouter(prefix="/events", tags=["events"])


def _get_group_for_user(db: Session, group_id: UUID, user_id: UUID) -> Group:
    group = db.query(Group).filter(Group.id == group_id, Group.user_id == user_id).first()
    if not group:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Grupo nao encontrado.")
    return group


def _get_match_for_user(db: Session, match_id: UUID, user_id: UUID) -> Match:
    match = (
        db.query(Match)
        .join(Group, Group.id == Match.group_id)
        .filter(Match.id == match_id, Group.user_id == user_id)
        .first()
    )
    if not match:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Partida nao encontrada para este usuario.")
    return match


def _match_response(match: Match) -> schemas.MatchResponse:
    return schemas.MatchResponse(
        id=str(match.id),
        group_id=str(match.group_id),
        titulo=match.titulo,
        starts_at=match.starts_at,
        local=match.local,
        team_size=match.team_size,
        goalkeepers_fixed=match.goalkeepers_fixed,
        created_at=match.created_at,
    )


def _serialize_match_player(entry: MatchPlayer, player: Player) -> schemas.MatchDetailPlayer:
    return schemas.MatchDetailPlayer(
        match_player_id=str(entry.id),
        player_id=str(player.id),
        nome=player.nome,
        is_goalkeeper=entry.is_goalkeeper,
        is_present=entry.is_present,
        team_number=entry.team_number,
        order_position=entry.order_position,
        has_played=entry.has_played,
    )


def _serialize_event_row(event: Event, primary: Optional[Player], assist: Optional[Player]) -> schemas.EventResponse:
    return schemas.EventResponse(
        id=str(event.id),
        match_id=str(event.match_id),
        tipo=schemas.EventType(event.tipo.value if isinstance(event.tipo, ModelEventType) else event.tipo),
        player_id=str(primary.id) if primary else None,
        player_nome=primary.nome if primary else None,
        assist_player_id=str(assist.id) if assist else None,
        assist_player_nome=assist.nome if assist else None,
        description=event.description,
        created_at=event.created_at,
    )


def _match_detail(match: Match, db: Session) -> schemas.MatchDetailResponse:
    entries = (
        db.query(MatchPlayer, Player)
        .join(Player, Player.id == MatchPlayer.player_id)
        .filter(MatchPlayer.match_id == match.id)
        .order_by(MatchPlayer.order_position.asc(), Player.nome.asc())
        .all()
    )

    teams: dict[str, list[schemas.MatchDetailPlayer]] = {}
    bench: list[schemas.MatchDetailPlayer] = []
    for entry, player in entries:
        serialized = _serialize_match_player(entry, player)
        if entry.team_number:
            key = str(entry.team_number)
            teams.setdefault(key, []).append(serialized)
        else:
            bench.append(serialized)

    assist_alias = aliased(Player)
    event_rows = (
        db.query(Event, Player, assist_alias)
        .outerjoin(Player, Player.id == Event.player_id)
        .outerjoin(assist_alias, assist_alias.id == Event.assist_player_id)
        .filter(Event.match_id == match.id)
        .order_by(Event.created_at.asc())
        .all()
    )
    events = [_serialize_event_row(event, primary, assist) for event, primary, assist in event_rows]

    active_numbers = [number for number in [match.active_team_one, match.active_team_two] if number]
    waiting_numbers = match.team_queue or []

    return schemas.MatchDetailResponse(
        id=str(match.id),
        group_id=str(match.group_id),
        titulo=match.titulo,
        starts_at=match.starts_at,
        status=match.status.value,
        team_size=match.team_size,
        goalkeepers_fixed=match.goalkeepers_fixed,
        created_at=match.created_at,
        finished_at=match.finished_at,
        teams=teams,
        bench=bench,
        events=events,
        active_team_numbers=active_numbers,
        waiting_team_numbers=waiting_numbers,
    )


def _serialize_generated_player(entry: MatchPlayer, player: Player) -> schemas.GeneratedTeamPlayer:
    return schemas.GeneratedTeamPlayer(
        match_player_id=str(entry.id),
        player_id=str(player.id),
        nome=player.nome,
        is_goalkeeper=entry.is_goalkeeper,
        order_position=entry.order_position,
    )


def _get_waiting_teams(match: Match) -> list[int]:
    return list(match.team_queue or [])


def _rotate_team_state(match: Match, team_number: int, db: Session) -> None:
    active_numbers = [number for number in [match.active_team_one, match.active_team_two] if number]
    if team_number not in active_numbers:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Somente times em quadra podem ser rotacionados.")

    queue = list(match.team_queue or [])
    if not queue:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Nao existem times aguardando para entrar.")

    incoming_team = queue.pop(0)
    queue.append(team_number)

    if match.active_team_one == team_number:
        match.active_team_one = incoming_team
    else:
        match.active_team_two = incoming_team

    match.team_queue = queue
    _mark_team_as_played(match.id, incoming_team, db)


def _mark_team_as_played(match_id: UUID, team_number: int, db: Session) -> None:
    (
        db.query(MatchPlayer)
        .filter(
            MatchPlayer.match_id == match_id,
            MatchPlayer.team_number == team_number,
            MatchPlayer.is_present.is_(True),
        )
        .update({MatchPlayer.has_played: True}, synchronize_session=False)
    )


def _handle_player_left(match: Match, player_entry: MatchPlayer, db: Session) -> None:
    target_team = player_entry.team_number
    active_numbers = [number for number in [match.active_team_one, match.active_team_two] if number]

    if not target_team or target_team not in active_numbers:
        player_entry.is_present = False
        db.add(player_entry)
        return

    _rotate_team_state(match, target_team, db)


@router.post("", response_model=schemas.MatchResponse, status_code=status.HTTP_201_CREATED)
def create_match(
    payload: schemas.MatchCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
) -> schemas.MatchResponse:
    group = _get_group_for_user(db, UUID(payload.group_id), current_user.id)

    match = Match(
        group_id=group.id,
        titulo=payload.titulo.strip(),
        starts_at=payload.starts_at,
        local=payload.local.strip() if payload.local else None,
        team_size=payload.team_size,
        goalkeepers_fixed=payload.goalkeepers_fixed,
    )
    db.add(match)
    db.commit()
    db.refresh(match)
    return _match_response(match)


@router.post("/{match_id}/players", response_model=schemas.MessageResponse, status_code=status.HTTP_200_OK)
def sync_match_players(
    match_id: UUID,
    payload: schemas.MatchPlayersSyncRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
) -> schemas.MessageResponse:
    match = _get_match_for_user(db, match_id, current_user.id)

    player_ids = {UUID(item.player_id) for item in payload.players}
    if not player_ids:
        db.query(MatchPlayer).filter(MatchPlayer.match_id == match.id).delete(synchronize_session=False)
        db.commit()
        return schemas.MessageResponse(message="Jogadores atualizados com sucesso.")

    valid_players = (
        db.query(Player.id)
        .filter(Player.group_id == match.group_id, Player.id.in_(player_ids))
        .all()
    )
    if len(valid_players) != len(player_ids):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Jogadores invalidos para este grupo.")

    db.query(MatchPlayer).filter(MatchPlayer.match_id == match.id).delete(synchronize_session=False)

    entries = []
    for item in payload.players:
        entry = MatchPlayer(
            match_id=match.id,
            player_id=UUID(item.player_id),
            is_present=item.is_present,
            is_goalkeeper=item.is_goalkeeper,
            order_position=item.order_position,
        )
        entries.append(entry)

    if entries:
        db.bulk_save_objects(entries)

    db.commit()
    return schemas.MessageResponse(message="Jogadores atualizados com sucesso.")


@router.post("/{match_id}/generate-teams", response_model=schemas.GenerateTeamsResponse, status_code=status.HTTP_200_OK)
def generate_match_teams(
    match_id: UUID,
    payload: schemas.GenerateTeamsRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
) -> schemas.GenerateTeamsResponse:
    match = _get_match_for_user(db, match_id, current_user.id)

    team_size = payload.team_size or match.team_size or 5
    goalkeepers_fixed = payload.goalkeepers_fixed if payload.goalkeepers_fixed is not None else match.goalkeepers_fixed

    entries = (
        db.query(MatchPlayer, Player)
        .join(Player, Player.id == MatchPlayer.player_id)
        .filter(MatchPlayer.match_id == match.id)
        .order_by(MatchPlayer.order_position.asc(), Player.nome.asc())
        .all()
    )

    present_entries = [item for item in entries if item[0].is_present]
    line_entries = [item for item in present_entries if not item[0].is_goalkeeper]
    goalkeeper_entries = [item for item in present_entries if item[0].is_goalkeeper]

    if len(line_entries) < team_size * 2:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Quantidade insuficiente de jogadores de linha para montar pelo menos duas equipes.")

    teams_count = max(2, math.ceil(len(line_entries) / team_size))
    teams: dict[int, list[tuple[MatchPlayer, Player]]] = {number: [] for number in range(1, teams_count + 1)}

    for index, (entry, player) in enumerate(line_entries):
        team_number = min(index // team_size, teams_count - 1) + 1
        entry.team_number = team_number
        teams[team_number].append((entry, player))

    for idx, (entry, player) in enumerate(goalkeeper_entries):
        preferred_team = entry.team_number if goalkeepers_fixed and entry.team_number in teams else None
        team_number = preferred_team or ((idx % teams_count) + 1)
        entry.team_number = team_number
        teams[team_number].append((entry, player))

    for entry, _ in present_entries:
        if entry.team_number is None:
            entry.team_number = 1

    active_slots = [1]
    if teams_count > 1:
        active_slots.append(2)
    waiting_slots = [number for number in range(1, teams_count + 1) if number not in active_slots]

    for entry, _ in entries:
        entry.has_played = False
        if entry.team_number:
            entry.is_present = True
            if entry.team_number in active_slots:
                entry.has_played = True

    match.team_size = team_size
    match.goalkeepers_fixed = goalkeepers_fixed
    match.generated_at = datetime.utcnow()
    match.active_team_one = active_slots[0] if active_slots else None
    match.active_team_two = active_slots[1] if len(active_slots) > 1 else None
    match.team_queue = waiting_slots
    db.add(match)
    db.commit()
    for entry, _ in entries:
        db.refresh(entry)

    response_teams = [
        schemas.GeneratedTeam(
            team_number=team_number,
            players=[_serialize_generated_player(entry, player) for entry, player in members],
        )
        for team_number, members in teams.items()
    ]

    return schemas.GenerateTeamsResponse(teams=response_teams, bench=[])


@router.get("/{match_id}", response_model=schemas.MatchDetailResponse, status_code=status.HTTP_200_OK)
def get_match_detail(
    match_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
) -> schemas.MatchDetailResponse:
    match = _get_match_for_user(db, match_id, current_user.id)
    return _match_detail(match, db)


@router.post("/{match_id}/next-team", response_model=schemas.MatchDetailResponse, status_code=status.HTTP_200_OK)
def rotate_team(
    match_id: UUID,
    payload: schemas.NextTeamRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
) -> schemas.MatchDetailResponse:
    match = _get_match_for_user(db, match_id, current_user.id)

    team_number = payload.team_number
    _rotate_team_state(match, team_number, db)
    db.add(match)
    db.commit()
    db.refresh(match)
    return _match_detail(match, db)


@router.post("/{match_id}/finish", response_model=schemas.FinishMatchResponse, status_code=status.HTTP_200_OK)
def finish_match(
    match_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
) -> schemas.FinishMatchResponse:
    match = _get_match_for_user(db, match_id, current_user.id)
    match.status = MatchStatus.FINISHED
    match.finished_at = datetime.utcnow()
    db.add(match)
    db.commit()
    db.refresh(match)
    return schemas.FinishMatchResponse(id=str(match.id), status=match.status.value, finished_at=match.finished_at)


@events_router.post("", response_model=schemas.EventResponse, status_code=status.HTTP_201_CREATED)
def create_event(
    payload: schemas.EventCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
) -> schemas.EventResponse:
    match = _get_match_for_user(db, UUID(payload.match_id), current_user.id)

    player = None
    assist = None
    player_id = UUID(payload.player_id) if payload.player_id else None
    assist_id = UUID(payload.assist_player_id) if payload.assist_player_id else None

    if player_id:
        player = db.query(Player).filter(Player.id == player_id, Player.group_id == match.group_id).first()
        if not player:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Jogador invalido para este grupo.")
    if assist_id:
        assist = db.query(Player).filter(Player.id == assist_id, Player.group_id == match.group_id).first()
        if not assist:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Assistencia invalida para este grupo.")

    event = Event(
        match_id=match.id,
        player_id=player.id if player else None,
        assist_player_id=assist.id if assist else None,
        tipo=ModelEventType(payload.tipo.value),
        description=payload.description,
    )
    db.add(event)

    if event.tipo == ModelEventType.LEFT_FIELD:
        if not player:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Informe o jogador que deixou o campo.")
        player_entry = (
            db.query(MatchPlayer)
            .filter(MatchPlayer.match_id == match.id, MatchPlayer.player_id == player.id)
            .first()
        )
        if not player_entry:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Jogador nao esta vinculado a esta partida.")
        _handle_player_left(match, player_entry, db)

    db.commit()
    db.refresh(event)
    if event.tipo == ModelEventType.LEFT_FIELD:
        db.refresh(match)

    return _serialize_event_row(event, player, assist)
