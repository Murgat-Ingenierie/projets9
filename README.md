# Gestionnaire de projet — Les Fontaines

Application web de gestion de projet (vue Gantt centrale) pour piloter les
Epics opérationnels et stratégiques de la pisciculture.

## Statut

- **Phase 1 — Définition** : terminée. Voir [docs/SPEC.md](docs/SPEC.md) — révisée en **v0.2** le
  2026-07-17 pour être réconciliée avec le code livré (modèle, 25 invariants actifs, écrans, stack).
- **Phase 2 — Tests auto basés sur les invariants** : **faite**. 204 tests, les 25
  invariants actifs couverts sur trois couches, la suite rejouée sur PostgreSQL. Voir ci-dessous.
- **v0** : scaffolding complet (API + front + Docker Compose + CI).

> **Authentification : Keycloak (OIDC)** depuis le 2026-07-29. Le front redirige vers le realm
> (*authorization code* + PKCE S256), l'API valide le jeton en RS256/JWKS. Keycloak fait autorité
> sur l'identité et les rôles ; le rôle `app-projets9-access` conditionne l'accès à l'application.
>
> ⚠️ **L'adossement est inactif tant qu'il n'est pas configuré** : une installation neuve démarre
> en mode débrayé (`AUTH_DISABLED=true`), donc **sans authentification**. C'est voulu — on peut
> développer sans dépendre du realm — mais cela **doit être configuré avant toute mise en ligne**.
> Voir « Authentification » ci-dessous.

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

Il n'y a **pas d'écran de connexion** : l'application s'ouvre directement sur le planning
(cf. l'avertissement ci-dessus). Le compte admin créé par la seed
(`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`) sert encore aux scripts et redeviendra le compte
d'entrée quand l'authentification sera rebranchée.

### Authentification (Keycloak)

Renseigner dans `.env` — **non versionné**, aucune de ces valeurs n'a sa place dans le dépôt :

```bash
KEYCLOAK_BASE_URL=https://<serveur-keycloak>   # API : validation des jetons
KEYCLOAK_REALM=<realm>
KEYCLOAK_ORIGIN=https://<serveur-keycloak>     # proxy : autorise l'origine dans la CSP
VITE_OIDC_AUTHORITY=https://<serveur-keycloak>/realms/<realm>   # front
VITE_OIDC_CLIENT_ID=projets9-front
AUTH_DISABLED=false                            # à basculer EN MÊME TEMPS
```

Côté realm, deux clients : **`projets9-front`** (public, PKCE S256, URI de redirection
`<origine>/auth/callback`) et **`projets9-api`** (audience, porteur des rôles). Trois rôles sur
`projets9-api` : `app-projets9-access` (porte d'entrée — sans lui, accès refusé), `admin`,
`membre`. Le client front a besoin d'un *audience mapper* vers `projets9-api`, sans quoi l'API
rejette le jeton.

⚠️ Deux pièges qui coûtent du temps :
- les `VITE_OIDC_*` sont inscrites dans le bundle **au build** — les changer impose
  `docker compose up -d --build web`, un redémarrage ne suffit pas ;
- `KEYCLOAK_ORIGIN` est **indispensable** : sans elle, la CSP du proxy bloque le navigateur qui
  tente de joindre Keycloak, avec pour seul symptôme un « Failed to fetch ».

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

Le dossier `data/` **entier** est gitignoré : ni le classeur réel, ni les fichiers dérivés
(nettoyés, journaux d'import) ne rentrent dans le dépôt.
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
│   │   ├── auth/           # JWT + bcrypt (débrayé, cf. avertissement)
│   │   ├── invariants/     # Règles métier (INV-1 … INV-21)
│   │   ├── seed.py         # Peuplement initial
│   │   └── main.py
│   ├── alembic/            # Migrations
│   └── tests/
├── web/                    # Frontend React 19 + Vite 8 + TypeScript 6
│   ├── e2e/                # Playwright (planning)
│   └── src/
│       ├── api/            # Client HTTP
│       ├── pages/          # Planning (SVAR), CRUDs, Paramètres
│       ├── planning/       # Logique pure du planning, sous tests
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

GitHub Actions s'exécute sur **toute pull request** et à la demande (`workflow_dispatch`).
**5 jobs, tous bloquants** :

| Job | Contenu |
|---|---|
| `api` | `ruff` · migrations + `alembic check` sur Postgres · `pytest` **deux fois** : SQLite puis PostgreSQL |
| `web` | `npm ci` → `lint` → `test` (Vitest) → `build` |
| `e2e` | **Playwright** sur le planning (API mockée, aucun backend) |
| `sast` | **Semgrep**, 8 rulesets — rouge au moindre finding |
| `dast` | **ZAP Baseline** contre la stack complète, qu'il construit et démarre |

Le job « Docker — build images » a été retiré : le DAST construit déjà les trois images, et les
démarre. Les dépendances sont suivies par **Dependabot** (*cooldown* de 7 jours).

Il n'y a **pas** de déclencheur sur `push` : tout ce qui entre dans `main` passe par une PR,
donc a déjà été testé — le rejouer sur le commit de merge ferait doublon.

Sur une branche de travail sans PR, la CI ne tourne donc pas : ouvrir une PR (même en
*draft*) suffit à obtenir le signal.

> Ce choix suppose que `main` soit **protégée** — c'est le cas depuis le 2026-07-28 : PR
> obligatoire, status checks en mode *strict* (la branche doit être à jour, donc l'état testé
> **est** l'état fusionné), force-push et suppression bloqués. À savoir : la protection de branche
> n'existe pas sur un dépôt privé en plan *free* — la repasser en privé la ferait perdre.
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
cd api && pip install -e ".[dev]" && pytest -q     # 203 passed, 1 skipped (SQLite)

# La même suite sur PostgreSQL — c'est ce que fait la CI (C12b) :
TEST_DATABASE_URL=postgresql+psycopg://user:pass@localhost:5432/gestion_test pytest -q  # 204 passed
```

Les deux défauts qui étaient documentés en `xfail(strict=True)` — orphelinage d'un jalon et refus
du domaine `.local` à la création d'un compte — sont désormais **corrigés**, et leurs `xfail` sont
devenus des tests de régression verts. C'est le mécanisme voulu : un `xfail(strict=True)` force à
retirer le marqueur dès que le bug est réglé (sinon la suite échoue).

Les tests tournent sur **SQLite en mémoire par défaut** (rapide, aucun service à lancer) : ce
qu'ils éprouvent avant tout, c'est l'application des invariants par les *routes*. Depuis C12b, la
CI **rejoue la même suite sur PostgreSQL** (`TEST_DATABASE_URL`), ce qui couvre la dernière ligne
de défense — les contraintes `CHECK` et surtout les **types ENUM natifs**, que SQLite ne sait pas
fournir : il range un enum en TEXT et accepte n'importe quelle chaîne. D'où
[`tests/test_contraintes_base.py`](api/tests/test_contraintes_base.py), qui contourne les routes
pour écrire directement en base ; un de ses tests est ignoré hors PostgreSQL.
