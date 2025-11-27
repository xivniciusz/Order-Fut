from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

from jose import JWTError, jwt
from passlib.context import CryptContext

from .config import settings

pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return pwd_context.verify(password, password_hash)


def create_token(subject: str, expires_minutes: int) -> tuple[str, int]:
    expire_at = datetime.utcnow() + timedelta(minutes=expires_minutes)
    payload: dict[str, Any] = {"sub": subject, "exp": expire_at}
    token = jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)
    return token, int(expires_minutes * 60)


def create_access_and_refresh_tokens(user_id: str) -> tuple[str, str, int]:
    access_token, access_expires = create_token(user_id, settings.access_token_expires_minutes)
    refresh_token, _ = create_token(user_id, settings.refresh_token_expires_minutes)
    return access_token, refresh_token, access_expires


class InvalidTokenError(Exception):
    """Excecao usada quando o token nao pode ser validado."""


def decode_token(token: str) -> str:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError as exc:
        raise InvalidTokenError("Token invalido.") from exc

    subject = payload.get("sub")
    if not subject:
        raise InvalidTokenError("Token sem identificador de usuario.")
    return str(subject)
