import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes import (
    auth,
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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
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
