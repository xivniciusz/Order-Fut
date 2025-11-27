from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from .. import schemas
from ..database import get_session
from ..dependencies import get_current_user
from ..models import Group, Player, User

router = APIRouter(prefix="/players", tags=["players"])


ALLOWED_POSITIONS = {position.value for position in schemas.PlayerPosition}


def _get_group_or_404(db: Session, group_id: UUID, user_id: UUID) -> Group:
    group = db.query(Group).filter(Group.id == group_id, Group.user_id == user_id).first()
    if not group:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Grupo nao encontrado.")
    return group


def _get_player_or_404(db: Session, player_id: UUID, user_id: UUID) -> Player:
    player = (
        db.query(Player)
        .join(Group, Group.id == Player.group_id)
        .filter(Player.id == player_id, Group.user_id == user_id)
        .first()
    )
    if not player:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Jogador nao encontrado.")
    return player


def _player_response(player: Player) -> schemas.PlayerResponse:
    return schemas.PlayerResponse(
        id=str(player.id),
        group_id=str(player.group_id),
        nome=player.nome,
        posicao=schemas.PlayerPosition(player.posicao or schemas.PlayerPosition.DEF.value),
        numero_camisa=player.numero_camisa,
        created_at=player.created_at,
    )


def _normalize_name(value: str) -> str:
    return " ".join(part.capitalize() for part in value.strip().split())


@router.get("", response_model=schemas.PlayersListResponse)
def list_players(
    group_id: UUID = Query(..., description="Identificador do grupo"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
) -> schemas.PlayersListResponse:
    _get_group_or_404(db, group_id, current_user.id)

    players = (
        db.query(Player)
        .filter(Player.group_id == group_id)
        .order_by(func.lower(Player.nome))
        .all()
    )
    return schemas.PlayersListResponse(players=[_player_response(player) for player in players])


@router.post("", response_model=schemas.PlayerResponse, status_code=status.HTTP_201_CREATED)
def create_player(
    payload: schemas.PlayerCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
) -> schemas.PlayerResponse:
    group_uuid = UUID(payload.group_id)
    _get_group_or_404(db, group_uuid, current_user.id)

    if payload.posicao not in ALLOWED_POSITIONS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Posicao invalida.")

    player = Player(
        group_id=group_uuid,
        nome=_normalize_name(payload.nome),
        posicao=payload.posicao,
        numero_camisa=payload.numero_camisa,
    )
    db.add(player)
    db.commit()
    db.refresh(player)
    return _player_response(player)


@router.put("/{player_id}", response_model=schemas.PlayerResponse)
def update_player(
    player_id: UUID,
    payload: schemas.PlayerUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
) -> schemas.PlayerResponse:
    player = _get_player_or_404(db, player_id, current_user.id)

    if payload.nome is None and payload.posicao is None and payload.numero_camisa is None and payload.group_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Nada para atualizar.")

    if payload.nome is not None:
        player.nome = _normalize_name(payload.nome)

    if payload.posicao is not None:
        if payload.posicao.value not in ALLOWED_POSITIONS:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Posicao invalida.")
        player.posicao = payload.posicao.value

    if payload.numero_camisa is not None:
        player.numero_camisa = payload.numero_camisa

    if payload.group_id is not None:
        target_group = _get_group_or_404(db, UUID(payload.group_id), current_user.id)
        player.group_id = target_group.id

    db.add(player)
    db.commit()
    db.refresh(player)
    return _player_response(player)


@router.delete("/{player_id}", response_model=schemas.MessageResponse)
def delete_player(
    player_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
) -> schemas.MessageResponse:
    player = _get_player_or_404(db, player_id, current_user.id)
    db.delete(player)
    db.commit()
    return schemas.MessageResponse(message="Jogador removido com sucesso.")
