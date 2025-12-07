from functools import lru_cache
from pydantic import BaseModel, Field
import os
from pathlib import Path
from dotenv import load_dotenv

# Carregar variáveis do .env
env_file = Path(__file__).parent.parent / ".env"
load_dotenv(env_file)


class Settings(BaseModel):
    app_name: str = Field(default="Order Fut API")
    debug: bool = Field(default=False)
    database_url: str = Field(
        default="postgresql+psycopg://postgres:postgres@localhost:5432/order_fut",
        alias="DATABASE_URL",
    )
    allowed_origins: list[str] = Field(
        default_factory=lambda: ["http://localhost:5173"],
        alias="ALLOWED_ORIGINS",
    )
    jwt_secret: str = Field(default="DEV_ONLY_SECRET", alias="JWT_SECRET")
    jwt_algorithm: str = Field(default="HS256", alias="JWT_ALGORITHM")
    access_token_expires_minutes: int = Field(
        default=15,
        alias="ACCESS_TOKEN_EXPIRES_MINUTES",
    )
    refresh_token_expires_minutes: int = Field(
        default=60 * 24 * 7,
        alias="REFRESH_TOKEN_EXPIRES_MINUTES",
    )
    password_reset_token_minutes: int = Field(
        default=30,
        alias="PASSWORD_RESET_TOKEN_MINUTES",
    )
    frontend_base_url: str = Field(default="http://localhost:5173", alias="FRONTEND_BASE_URL")

    class Config:
        populate_by_name = True


@lru_cache()
def get_settings() -> Settings:
    return Settings(
        debug=os.getenv("DEBUG", "false").lower() == "true",
        database_url=os.getenv(
            "DATABASE_URL",
            "postgresql+psycopg://postgres:postgres@localhost:5432/order_fut",
        ),
        allowed_origins=os.getenv(
            "ALLOWED_ORIGINS",
            "http://localhost:5173,https://orderfut.netlify.app",
        ).split(","),
        jwt_secret=os.getenv("JWT_SECRET", "DEV_ONLY_SECRET"),
        jwt_algorithm=os.getenv("JWT_ALGORITHM", "HS256"),
        access_token_expires_minutes=int(os.getenv("ACCESS_TOKEN_EXPIRES_MINUTES", "15")),
        refresh_token_expires_minutes=int(os.getenv("REFRESH_TOKEN_EXPIRES_MINUTES", str(60 * 24 * 7))),
        password_reset_token_minutes=int(os.getenv("PASSWORD_RESET_TOKEN_MINUTES", "30")),
        frontend_base_url=os.getenv("FRONTEND_BASE_URL", "http://localhost:5173"),
    )


settings = get_settings()
