from __future__ import annotations

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from .. import schemas
from ..database import get_session
from ..dependencies import get_current_user
from ..models import Group, Player, User

router = APIRouter(prefix="/groups", tags=["groups"])


def _group_to_response(group: Group, players_count: int) -> schemas.GroupResponse:
    current_year = datetime.utcnow().year
    return schemas.GroupResponse(
        id=str(group.id),
        nome=group.nome,
        foundation_year=group.foundation_year,
        current_year=current_year,
        descricao=group.descricao,
        is_active=group.is_active,
        created_at=group.created_at,
        players_count=players_count,
    )


def _fetch_player_counts(db: Session, group_ids: list[UUID]) -> dict[UUID, int]:
    if not group_ids:
        return {}
    rows = (
        db.query(Player.group_id, func.count(Player.id))
        .filter(Player.group_id.in_(group_ids))
        .group_by(Player.group_id)
        .all()
    )
    return {row[0]: int(row[1]) for row in rows}


def _get_group_or_404(db: Session, group_id: UUID, user_id: UUID) -> Group:
    group = db.query(Group).filter(Group.id == group_id, Group.user_id == user_id).first()
    if not group:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Grupo nao encontrado.")
    return group


def _normalize_description(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    cleaned = value.strip()
    return cleaned if cleaned else None


@router.get("", response_model=schemas.GroupsListResponse)
def list_groups(current_user: User = Depends(get_current_user), db: Session = Depends(get_session)) -> schemas.GroupsListResponse:
    groups = (
        db.query(Group)
        .filter(Group.user_id == current_user.id)
        .order_by(Group.created_at.desc())
        .all()
    )
    if not groups:
        return schemas.GroupsListResponse(groups=[])

    player_counts = _fetch_player_counts(db, [group.id for group in groups])
    return schemas.GroupsListResponse(
        groups=[_group_to_response(group, player_counts.get(group.id, 0)) for group in groups]
    )


@router.post("", response_model=schemas.GroupResponse, status_code=status.HTTP_201_CREATED)
def create_group(payload: schemas.GroupCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_session)) -> schemas.GroupResponse:
    existing = (
        db.query(Group)
        .filter(Group.user_id == current_user.id, func.lower(Group.nome) == func.lower(payload.nome.strip()))
        .first()
    )
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Ja existe um grupo com este nome.")

    has_active = db.query(Group).filter(Group.user_id == current_user.id, Group.is_active.is_(True)).first()
    now = datetime.utcnow()
    group = Group(
        nome=payload.nome.strip(),
        descricao=_normalize_description(payload.descricao),
        foundation_year=now.year,
        current_year=now.year,
        user_id=current_user.id,
        is_active=has_active is None,
    )
    db.add(group)
    db.commit()
    db.refresh(group)
    return _group_to_response(group, players_count=0)


@router.put("/{group_id}", response_model=schemas.GroupResponse)
def update_group(
    group_id: UUID,
    payload: schemas.GroupUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
) -> schemas.GroupResponse:
    group = _get_group_or_404(db, group_id, current_user.id)

    if payload.nome is None and payload.descricao is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Nenhum campo informado para atualizacao.")

    if payload.nome is not None:
        group.nome = payload.nome.strip()
    if payload.descricao is not None:
        group.descricao = _normalize_description(payload.descricao)

    db.add(group)
    db.commit()
    db.refresh(group)

    player_counts = _fetch_player_counts(db, [group.id])
    return _group_to_response(group, player_counts.get(group.id, 0))


@router.delete("/{group_id}", response_model=schemas.MessageResponse)
def delete_group(group_id: UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_session)) -> schemas.MessageResponse:
    group = _get_group_or_404(db, group_id, current_user.id)
    was_active = group.is_active

    db.delete(group)
    db.commit()

    if was_active:
        next_group = (
            db.query(Group)
            .filter(Group.user_id == current_user.id)
            .order_by(Group.created_at.asc())
            .first()
        )
        if next_group:
            next_group.is_active = True
            db.add(next_group)
            db.commit()

    return schemas.MessageResponse(message="Grupo removido com sucesso.")


@router.post("/{group_id}/set-active", response_model=schemas.MessageResponse)
def set_active_group(group_id: UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_session)) -> schemas.MessageResponse:
    target = _get_group_or_404(db, group_id, current_user.id)

    groups = db.query(Group).filter(Group.user_id == current_user.id).all()
    for group in groups:
        group.is_active = group.id == target.id
        db.add(group)
    db.commit()

    return schemas.MessageResponse(message="Grupo definido como ativo.")