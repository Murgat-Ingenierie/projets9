# Gestionnaire de projet — Les Fontaines

Application web de gestion de projet (vue Gantt centrale) pour piloter les
Epics opérationnels et stratégiques de la pisciculture.

## Statut

- **Phase 1 — Définition** : terminée. Voir [docs/SPEC.md](docs/SPEC.md) — révisée en **v0.2** le
  2026-07-17 pour être réconciliée avec le code livré (modèle, 25 invariants actifs, écrans, stack).
- **Phase 2 — Tests auto basés sur les invariants** : **faite**. 183 tests + 2 xfail, les 25
  invariants actifs couverts sur trois couches. Voir ci-dessous.
- **v0** : scaffolding complet (API + front + Docker Compose + CI).

État de l'existant, dette et chantiers ouverts : [INVENTAIRE.md](INVENTAIRE.md).

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

### Jeu de démonstration

Une installation neuve ne contient que les epics (le planning est donc vide).
Pour peupler le Gantt avec un jeu réaliste — projets, tâches, jalons,
dépendances, équipes, mesures — qui illustre toutes les vues :

```bash
# soit au démarrage : mettre SEED_DEMO=true dans .env avant `docker compose up`
# soit à la demande, sur une base déjà lancée :
docker compose exec api python -m app.seed_demo
```

Idempotent : ne s'exécute jamais par-dessus des données existantes. À laisser
désactivé pour une installation réelle.

### Import du classeur source (données réelles)

`scripts/import_data.py` importe le classeur Google Sheets exporté en `.xlsx`
**via l'API** — donc à travers les invariants (une ligne invalide est refusée,
pas insérée en douce). Idempotent, ré-exécutable sans doublons.

```bash
pip install -e "api/[scripts]"                      # requests + openpyxl

# Format attendu du classeur : voir la docstring de scripts/import_data.py.
# `make_sample_source.py` génère un exemple conforme (spec exécutable) :
python scripts/make_sample_source.py --out data/source.xlsx

python scripts/import_data.py \
    --api http://localhost:8080 \
    --xlsx data/source.xlsx \
    --email "$SEED_ADMIN_EMAIL" --password "$SEED_ADMIN_PASSWORD"
```

`data/*.xlsx` est gitignoré : le vrai classeur ne rentre pas dans le dépôt.
L'import crée des utilisateurs, il faut donc un compte **admin** (`--email` /
`--password`, ou `--token`, ou `AUTH_DISABLED=true` en dev).

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

GitHub Actions s'exécute sur **toute pull request** et à la demande (`workflow_dispatch`) :
- Lint Python (`ruff`) + tests `pytest`
- Lint front (`eslint`) + build TypeScript
- Build des trois images Docker

Il n'y a **pas** de déclencheur sur `push` : tout ce qui entre dans `main` passe par une PR,
donc a déjà été testé — le rejouer sur le commit de merge ferait doublon.

Sur une branche de travail sans PR, la CI ne tourne donc pas : ouvrir une PR (même en
*draft*) suffit à obtenir le signal.

> ⚠️ Ce choix suppose que `main` soit **protégée** (PR obligatoire + status checks en mode
> *strict*). Tant que ce n'est pas en place, un push direct sur `main` ne déclenche plus rien.
> Voir [INVENTAIRE.md](INVENTAIRE.md), chantier **C13**.

## Phase 2 — Tests auto basés sur les invariants

Les invariants sont codés dans [api/app/invariants/checks.py](api/app/invariants/checks.py).
Chacun lève `InvariantError(code="INV-X", ...)` avec l'ID stable défini dans
[docs/SPEC.md](docs/SPEC.md).

Chaque ID `INV-X` donne lieu à au moins un test. Les trois couches prévues sont en place :

| Fichier | Rôle |
|---|---|
| [`tests/test_invariants_unit.py`](api/tests/test_invariants_unit.py) | Test unitaire par `check_*`, cas valides **et** invalides. Sans base ni SQLAlchemy : les checks sont purs, on leur passe des dataclasses. |
| [`tests/test_invariants_api.py`](api/tests/test_invariants_api.py) | Intégration via l'API : mutation refusée **avec le bon code**. Seul chemin possible pour INV-4, INV-5, INV-AUTH-1, INV-21, qui n'ont pas de fonction dédiée. |
| [`tests/test_invariants_hypothesis.py`](api/tests/test_invariants_hypothesis.py) | Propriétés générées. INV-14 est confronté à un oracle indépendant (algorithme de Kahn) sur des centaines de graphes. |
| [`tests/test_couverture_invariants.py`](api/tests/test_couverture_invariants.py) | Garde-fou : échoue si un `INV-X` est levé sans test qui le cite. Une règle que rien ne fait respecter finit par ne plus l'être. |

```bash
cd api && pip install -e ".[dev]" && pytest -q     # 183 passed, 2 xfailed
```

Deux `xfail(strict=True)` documentent des **défauts connus** (orphelinage d'un jalon, refus du
domaine `.local` à la création d'un compte) : le jour où ils sont corrigés, la suite échoue tant
que le marqueur n'est pas retiré.

Les tests d'intégration tournent sur SQLite en mémoire : ce qu'ils éprouvent, c'est l'application
des invariants par les *routes*. Les contraintes en base ne sont donc pas couvertes — cf.
[INVENTAIRE.md](INVENTAIRE.md), chantier C12.
