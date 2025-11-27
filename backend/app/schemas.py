from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field


class UserBase(BaseModel):
    nome: str
    email: EmailStr

    class Config:
        from_attributes = True


class UserPublic(UserBase):
    id: str
    created_at: datetime


MAX_PASSWORD_LENGTH = 72


class RegisterRequest(BaseModel):
    nome: str = Field(min_length=3, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=MAX_PASSWORD_LENGTH)
    confirm_password: str = Field(min_length=8, max_length=MAX_PASSWORD_LENGTH)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=MAX_PASSWORD_LENGTH)


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    password: str = Field(min_length=8, max_length=MAX_PASSWORD_LENGTH)
    confirm_password: str = Field(min_length=8, max_length=MAX_PASSWORD_LENGTH)


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class AuthResponse(TokenPair):
    user: UserPublic


class MessageResponse(BaseModel):
    message: str
    detail: Optional[str] = None
