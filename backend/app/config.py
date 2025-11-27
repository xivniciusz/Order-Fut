from functools import lru_cache
from pydantic import BaseModel, Field
import os


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
    )


settings = get_settings()
