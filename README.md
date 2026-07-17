# Gestionnaire de projet — Les Fontaines

Application web de gestion de projet (vue Gantt centrale) pour piloter les
Epics opérationnels et stratégiques de la pisciculture.

## Statut

- **Phase 1 — Définition** : terminée. Voir [docs/SPEC.md](docs/SPEC.md) (modèle, 21 invariants, écrans, stack).
- **Phase 2 — Tests auto basés sur les invariants** : à venir.
- **v0** : scaffolding complet (API + front + Docker Compose + CI).

## Démarrage rapide (local)

```bash
# 1. Configurer l'environnement
cp .env.example .env
# Éditer .env et changer les mots de passe / secret JWT

# 2. Lancer la stack
docker compose up --build

# 3. Ouvrir
# - Application       : http://localhost:8080
# - API docs (Swagger): http://localhost:8080/api/docs
```

L'API exécute automatiquement au démarrage :
1. Les migrations Alembic (`alembic upgrade head`)
2. La *seed* (`python -m app.seed`) — crée l'admin initial et importe les
   epics depuis `Liste des projets en cours - Epic.csv` si la table est vide.

Connexion initiale avec `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` de `.env`.

## Structure

```
.
├── api/                    # Backend FastAPI + SQLAlchemy + Alembic
│   ├── app/
│   │   ├── models/         # Tables SQLAlchemy
│   │   ├── schemas/        # Pydantic
│   │   ├── routes/         # CRUD REST
│   │   ├── auth/           # JWT + bcrypt
│   │   ├── invariants/     # Règles métier (INV-1 … INV-21)
│   │   ├── seed.py         # Peuplement initial
│   │   └── main.py
│   ├── alembic/            # Migrations
│   └── tests/
├── web/                    # Frontend React + Vite + TypeScript
│   └── src/
│       ├── api/            # Client HTTP
│       ├── pages/          # Login, Gantt, CRUDs
│       └── types/
├── docker/
│   ├── backup/             # pg_dump quotidien
│   └── proxy/              # nginx en façade
├── docs/
│   ├── SPEC.md             # Spec figée — invariants & modèle
│   └── RESTORE.md          # Procédure de restauration
├── .github/workflows/ci.yml
└── docker-compose.yml
```

## Backup / Restore

`pg_dump` est exécuté quotidiennement à 03h00 dans le service `backup`
(volume Docker dédié, rétention 30 jours). Voir [docs/RESTORE.md](docs/RESTORE.md).

## CI

GitHub Actions s'exécute sur **push vers `main`**, sur **toute pull request**, et à la
demande (`workflow_dispatch`) :
- Lint Python (`ruff`) + tests `pytest`
- Lint front (`eslint`) + build TypeScript
- Build des trois images Docker

Sur une branche de travail sans PR, la CI ne tourne pas : ouvrir une PR (même en
*draft*) suffit à obtenir le signal.

## Phase 2 — Tests auto basés sur les invariants

Les invariants sont codés dans [api/app/invariants/checks.py](api/app/invariants/checks.py).
Chacun lève `InvariantError(code="INV-X", ...)` avec l'ID stable défini dans
[docs/SPEC.md](docs/SPEC.md).

À la phase 2, chaque ID `INV-X` donnera lieu à au moins un test :
- Test unitaire sur la fonction `check_*` (cas valides + cas invalides)
- Test d'intégration via l'API (mutation refusée avec le bon code)
- Tests générateurs Hypothesis pour couvrir des combinaisons larges
