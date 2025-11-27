from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

from jose import jwt
from passlib.context import CryptContext

from .config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


MAX_BCRYPT_BYTES = 72


def _normalize_secret(secret: str) -> str:
    data = secret.encode("utf-8")
    if len(data) <= MAX_BCRYPT_BYTES:
        return secret
    # Trunca respeitando fronteira de bytes UTF-8.
    truncated = data[:MAX_BCRYPT_BYTES]
    while (truncated[-1] & 0xC0) == 0x80:
        truncated = truncated[:-1]
    return truncated.decode("utf-8", errors="ignore")


def hash_password(password: str) -> str:
    safe_password = _normalize_secret(password)
    return pwd_context.hash(safe_password)


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
