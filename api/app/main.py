import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routes import (
    auth,
    backups,
    dependencies,
    epics,
    equipes,
    measures,
    milestones,
    projects,
    tache_equipe,
    tasks,
    users,
)

logging.basicConfig(level=logging.INFO)

# Le proxy ne transmet que /api/ : sans ces préfixes, la doc servie sur /docs
# est injoignable depuis le navigateur (cf. docker/proxy/nginx.conf).
app = FastAPI(
    title="Gestionnaire de projet — API",
    version="0.1.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

# CORS opt-in : même origine par défaut (proxy), donc middleware absent. On ne
# l'ajoute qu'avec une liste d'origines explicite — jamais de wildcard.
_cors_origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
if _cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

app.include_router(auth.router)
app.include_router(backups.router)
app.include_router(users.router)
app.include_router(epics.router)
app.include_router(projects.router)
app.include_router(tasks.router)
app.include_router(milestones.router)
app.include_router(dependencies.router)
app.include_router(measures.router)
app.include_router(equipes.router)
app.include_router(tache_equipe.router)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
