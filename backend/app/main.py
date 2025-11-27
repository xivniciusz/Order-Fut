from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from .config import settings
from .database import Base, engine, get_session
from .routes import auth, dashboard, groups, matches, players

app = FastAPI(title=settings.app_name, debug=settings.debug)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in settings.allowed_origins],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def init_database() -> None:
    Base.metadata.create_all(bind=engine)


app.include_router(auth.router)
app.include_router(groups.router)
app.include_router(players.router)
app.include_router(matches.router)
app.include_router(dashboard.router)


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
