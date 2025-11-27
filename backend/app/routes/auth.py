from __future__ import annotations

import hashlib
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import schemas
from ..config import settings
from ..database import get_session
from ..email_utils import send_password_reset_email
from ..models import PasswordResetToken, User
from ..security import create_access_and_refresh_tokens, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


def normalize_email(email: str) -> str:
    return email.strip().lower()


def to_auth_response(user: User) -> schemas.AuthResponse:
    access, refresh, expires_in = create_access_and_refresh_tokens(str(user.id))
    return schemas.AuthResponse(
        access_token=access,
        refresh_token=refresh,
        expires_in=expires_in,
        user=schemas.UserPublic(
            id=str(user.id),
            nome=user.nome,
            email=user.email,
            created_at=user.created_at,
        ),
    )


@router.post("/register", response_model=schemas.AuthResponse, status_code=status.HTTP_201_CREATED)
def register(payload: schemas.RegisterRequest, db: Session = Depends(get_session)) -> schemas.AuthResponse:
    if payload.password != payload.confirm_password:
        raise HTTPException(status_code=400, detail="As senhas nao coincidem.")

    email = normalize_email(payload.email)
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email ja cadastrado.")

    user = User(nome=payload.nome.strip(), email=email, senha_hash=hash_password(payload.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    return to_auth_response(user)


@router.post("/login", response_model=schemas.AuthResponse)
def login(payload: schemas.LoginRequest, db: Session = Depends(get_session)) -> schemas.AuthResponse:
    email = normalize_email(payload.email)
    user = db.query(User).filter(User.email == email).first()
    if not user or not verify_password(payload.password, user.senha_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenciais invalidas.")
    return to_auth_response(user)


@router.post("/forgot-password", response_model=schemas.MessageResponse)
def forgot_password(payload: schemas.ForgotPasswordRequest, db: Session = Depends(get_session)) -> schemas.MessageResponse:
    email = normalize_email(payload.email)
    user = db.query(User).filter(User.email == email).first()
    if not user:
        # Nao revelar se email existe.
        return schemas.MessageResponse(message="Se o email estiver cadastrado, enviaremos instrucoes em instantes.")

    raw_token, token_hash = PasswordResetToken.generate_token_pair()
    expires_at = datetime.utcnow() + timedelta(minutes=settings.password_reset_token_minutes)
    reset_entry = PasswordResetToken(token_hash=token_hash, user_id=user.id, expires_at=expires_at)
    db.add(reset_entry)
    db.commit()

    reset_link = f"{settings.frontend_base_url.rstrip('/')}/reset?token={raw_token}"
    send_password_reset_email(user.email, reset_link)
    return schemas.MessageResponse(message="Se o email estiver cadastrado, enviaremos instrucoes em instantes.")


@router.post("/reset-password", response_model=schemas.MessageResponse)
def reset_password(payload: schemas.ResetPasswordRequest, db: Session = Depends(get_session)) -> schemas.MessageResponse:
    if payload.password != payload.confirm_password:
        raise HTTPException(status_code=400, detail="As senhas nao coincidem.")

    token_hash = hashlib.sha256(payload.token.encode("utf-8")).hexdigest()
    reset_entry = (
        db.query(PasswordResetToken)
        .filter(PasswordResetToken.token_hash == token_hash)
        .filter(PasswordResetToken.used_at.is_(None))
        .first()
    )
    if not reset_entry or reset_entry.expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Token invalido ou expirado.")

    user = db.query(User).filter(User.id == reset_entry.user_id).first()
    if not user:
        raise HTTPException(status_code=400, detail="Token invalido.")

    user.senha_hash = hash_password(payload.password)
    reset_entry.used_at = datetime.utcnow()
    db.add(user)
    db.add(reset_entry)
    db.commit()

    return schemas.MessageResponse(message="Senha redefinida com sucesso.")
