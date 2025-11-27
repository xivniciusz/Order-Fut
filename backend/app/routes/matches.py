from __future__ import annotations

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import schemas
from ..database import get_session
from ..dependencies import get_current_user
from ..models import Group, Match, MatchPlayer, Player, User

router = APIRouter(prefix="/matches", tags=["matches"])


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


def _serialize_generated_player(entry: MatchPlayer, player: Player) -> schemas.GeneratedTeamPlayer:
    return schemas.GeneratedTeamPlayer(
        match_player_id=str(entry.id),
        player_id=str(player.id),
        nome=player.nome,
        is_goalkeeper=entry.is_goalkeeper,
        order_position=entry.order_position,
    )


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
    if len(present_entries) < team_size * 2:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Quantidade insuficiente de jogadores presentes para gerar os times.")

    teams: dict[int, list[tuple[MatchPlayer, Player]]] = {1: [], 2: []}
    bench: list[tuple[MatchPlayer, Player]] = []

    queue = present_entries.copy()
    if goalkeepers_fixed:
        keepers = [item for item in queue if item[0].is_goalkeeper]
        if keepers:
            first_keeper = keepers[0]
            teams[1].append(first_keeper)
            queue.remove(first_keeper)
        if len(keepers) > 1:
            second_keeper = keepers[1]
            teams[2].append(second_keeper)
            queue.remove(second_keeper)

    team_cycle = [1, 2]
    cycle_index = 0
    for item in queue:
        available = None
        for _ in range(2):
            candidate = team_cycle[cycle_index % 2]
            cycle_index += 1
            if len(teams[candidate]) < team_size:
                available = candidate
                break
        if available is None:
            bench.append(item)
            continue
        teams[available].append(item)

    for team_number, members in teams.items():
        if len(members) > team_size:
            bench.extend(members[team_size:])
            teams[team_number] = members[:team_size]

    assigned_ids = {member[0].id for members in teams.values() for member in members}

    for team_number, members in teams.items():
        for entry, _ in members:
            entry.team_number = team_number
    for entry, _ in present_entries:
        if entry.id not in assigned_ids:
            entry.team_number = None

    match.team_size = team_size
    match.goalkeepers_fixed = goalkeepers_fixed
    match.generated_at = datetime.utcnow()
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
    response_bench = [_serialize_generated_player(entry, player) for entry, player in bench]

    return schemas.GenerateTeamsResponse(teams=response_teams, bench=response_bench)
