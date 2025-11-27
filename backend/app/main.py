from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from .database import get_session
from .config import settings

app = FastAPI(title=settings.app_name, debug=settings.debug)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in settings.allowed_origins],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", tags=["saude"])
def healthcheck() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/orders", tags=["pedidos"])
def list_orders(db: Session = Depends(get_session)) -> dict[str, list]:
    # Resposta temporaria ate que a logica de negocio seja implementada.
    return {"orders": []}


@app.get("/")
def root() -> dict[str, str]:
    return {"message": "Backend Order Fut esta em execucao"}
