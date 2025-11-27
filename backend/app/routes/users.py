from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from .. import schemas
from ..database import get_session
from ..dependencies import get_current_user
from ..models import User

router = APIRouter(prefix="/users", tags=["users"])

DEFAULT_PREFERENCES = {
    "theme": "system",
    "notifications_email": True,
    "notifications_push": False,
    "auto_rotate_goalkeepers": True,
}


def _build_preferences(raw: dict | None) -> schemas.UserPreferences:
    combined = {**DEFAULT_PREFERENCES, **(raw or {})}
    return schemas.UserPreferences(**combined)


def _serialize_user(user: User) -> schemas.UserProfileResponse:
    return schemas.UserProfileResponse(
        id=str(user.id),
        nome=user.nome,
        email=user.email,
        created_at=user.created_at,
        preferences=_build_preferences(user.preferences),
    )


@router.get("/me", response_model=schemas.UserProfileResponse, status_code=status.HTTP_200_OK)
def get_current_profile(current_user: User = Depends(get_current_user)) -> schemas.UserProfileResponse:
    return _serialize_user(current_user)


@router.put("/me/preferences", response_model=schemas.UserPreferences, status_code=status.HTTP_200_OK)
def update_preferences(
    payload: schemas.UserPreferencesUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
) -> schemas.UserPreferences:
    updated = {key: value for key, value in payload.model_dump(exclude_unset=True).items() if value is not None}
    merged = {**_build_preferences(current_user.preferences).model_dump(), **updated}
    current_user.preferences = merged
    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return schemas.UserPreferences(**merged)
