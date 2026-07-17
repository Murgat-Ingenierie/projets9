# Inventaire de l'existant

> **Établi le** : 2026-07-17 · **Commit** : `e260851` · **Branche** : `claude/project-setup-inventory-95cf59`
> **Méthode** : lecture exhaustive du code + stack démarrée et vérifiée en local (Docker Compose).
> **Objet** : photographier l'écart entre `docs/SPEC.md` (spec figée le 2026-05-19), `README.md`, et le code réel,
> pour servir de base de suivi avant la phase 2.
>
> Ce document est un instantané. À réactualiser quand les chantiers du §9 avancent.
>
> **MàJ 2026-07-17 — chantiers C1, C2, C3 et C10 appliqués.** Voir §1 et la SPEC
> [v0.2](docs/SPEC.md). La phase 2 est faite : les 25 invariants actifs sont couverts (§6).
> **Trois** affirmations de la première version de ce document étaient fausses et sont
> corrigées ici :
> 1. la CI n'est pas « rouge depuis 2 commits » mais **rouge depuis le commit initial, à l'étape
>    lint** — `pytest` n'était jamais atteint (§6) ;
> 2. le risque R2 (`alembic/env.py` → `drop_table`) était un **faux positif** (§8) ;
> 3. le RBAC n'est **pas** un écart à la SPEC §6 : celle-ci accorde explicitement au rôle `membre`
>    tout le CRUD métier, le code y est conforme (§7, R4).
>
> Ces trois erreurs partagent la même cause : une conclusion tirée d'une lecture partielle sans
> exécution. Les deux premières sont tombées en confrontant l'affirmation au réel (relancer le lint
> sur le commit initial ; retirer l'import et observer `alembic check`). D'où la règle appliquée
> depuis : **une affirmation de ce document doit être vérifiable par une commande**, et les
> commandes en question sont citées.

---

## 1. Démarrage — état vérifié

La procédure du `README.md` (`cp .env.example .env` → `docker compose up --build`) fonctionne,
**après deux correctifs** sans lesquels le démarrage documenté est incomplet :

| Service | État | Note |
|---|---|---|
| `db` | ✅ healthy | Postgres 16, 8 migrations appliquées jusqu'à `0008` |
| `api` | ✅ up | migrations + seed + uvicorn OK |
| `web` | ✅ up | login → Gantt rendu |
| `proxy` | ✅ up | `:8080` |
| `backup` | ✅ up | dump vérifié (3.7 Ko gz, 11 tables) |

### Correctifs appliqués pour obtenir ce démarrage

1. **`backup` en crash-loop** (`exec /usr/local/bin/entrypoint.sh: no such file or directory`).
   Cause : les `.sh` sont en LF dans git mais sortis en **CRLF** sur un checkout Windows
   (`core.autocrlf=true`, aucun `.gitattributes`). Le shebang devient `#!/bin/sh\r` et c'est
   **l'interpréteur** qui est introuvable — pas le script. → Ajout de `.gitattributes` (`*.sh text eol=lf`).
   *Bug invisible en CI (Linux) : ne touche que les postes Windows.*
2. **`/api/docs` en 404** alors que le `README.md` le donne comme URL de la doc Swagger.
   Cause : `main.py` ne fixait pas `docs_url`, donc FastAPI servait `/docs` — or le proxy ne route
   que `/api/`, rendant Swagger **injoignable depuis le navigateur**. → `docs_url`/`redoc_url`/`openapi_url`
   préfixés `/api` dans `api/app/main.py`.

### Étape 0 (chantier C1) — appliquée le 2026-07-17

| Correctif | Effet vérifié |
|---|---|
| Import mort retiré de `tests/test_smoke.py` | `pytest -q` → **2 passed** |
| `[tool.ruff.lint.flake8-bugbear] extend-immutable-calls` (FastAPI) | −82 `B008` |
| `extend-exclude = ["alembic/versions"]` | −41 (boilerplate de migration) |
| `ruff check --fix` (I001, UP017, F401) | −6, dont le `Boolean` mort de `models/epic.py` |
| `ignore = ["UP042"]` + commentaire | reporté en phase 2 : `StrEnum` change `str()` sur des enums sérialisés, à faire sous couverture de tests |
| Code mort INV-9 / INV-13 purgé (+ `HasDateRange`) | supprime aussi un `SELECT` + un `db.get` **par arête** à chaque create/update de tâche (`tasks.py::_validate`) |
| `alembic/env.py` : import `equipe` complété | hygiène — **pas** un correctif de bug, cf. §8 « faux positif écarté » |

**Résultat** : `ruff check .` → *All checks passed* · `pytest -q` → *2 passed*. Les deux étapes du job `api`
passent pour la première fois depuis la création du dépôt.

**Non-régression vérifiée de bout en bout** (19/19) contre la stack réelle : les invariants encore câblés
refusent toujours (INV-1, INV-4, INV-7, INV-8, INV-14, INV-15), ceux retirés acceptent bien
(INV-9 tâche hors fenêtre, INV-13 dépendance anti-chronologique), et les autofix n'ont cassé ni le JWT
(`exp − iat = 3600 s`) ni les timestamps.

### Ce que contient une installation neuve

| Entité | Volume après seed |
|---|---|
| epics | **10** |
| users | **1** (admin) |
| projects · tasks · milestones · dependencies · measures · equipes | **0** |

> ⚠️ **La vue Gantt — « vue centrale » de la SPEC — est vide au premier démarrage** (« Aucun projet planifié. »).
> La seed ne crée que les epics. Le seul outil qui peuple projets/tâches est `scripts/import_data.py`,
> qui lit `data/source.xlsx` — fichier **gitignoré et absent du dépôt**. Il n'existe donc aucun chemin
> supporté pour remplir le planning : tout doit être saisi à la main. Voir chantier **C4**.

---

## 2. Périmètre fonctionnel — SPEC §4 vs réel

**8 des 11 écrans spécifiés sont livrés, 1 partiel, 2 absents — et 2 écrans non spécifiés existent.**

| # | Écran (SPEC §4) | État | Détail |
|---|---|---|---|
| 1 | Login | ✅ | `/login` |
| 2 | Vue Gantt | ✅ **au-delà de la spec** | zoom Jour/Semaine/Mois, filtres **par équipe**, groupe par epic, undo, drag/resize, multi-sélection + décalage groupé, cascade FS, création/suppression de dépendance au drag, curseur « aujourd'hui » |
| 3 | CRUD Epics | ✅ | table triable + édition inline |
| 4 | CRUD Projets | ✅ | ⚠️ seule liste **sans** édition inline |
| 5 | CRUD Tâches | ✅ | |
| 6 | CRUD Jalons | ✅ | ⚠️ l'édition inline **perd les `project_ids`** |
| 7 | CRUD Dépendances | 🟡 | create/delete seulement — **pas d'update** (ni API, ni UI) |
| 8 | Page Epic (détail) | 🟡 | infos + projets + jalons OK — **la courbe de la Mesure dans le temps n'existe pas** |
| 9 | CRUD Mesures | ❌ | `measures.create/update/remove` **définis dans `endpoints.ts` mais jamais appelés**. Table lecture seule, pas de route, pas d'entrée de nav. |
| 10 | Gestion utilisateurs (admin) | ✅ | `/users`, nav gatée sur `role === "admin"` |
| 11 | Paramètres / Backup | ❌ | **totalement absent** — ni page, ni route, ni endpoint. Le backup ne se pilote qu'en ligne de commande (`docs/RESTORE.md`). |

### Écrans livrés mais **hors SPEC**

| Écran | Détail |
|---|---|
| `/equipes` (+ `/equipes/new`) | CRUD équipes (nom, temps dispo hebdo) |
| `/charge` | Heatmap charge équipes × semaines (4→52 sem), détail par cellule, dépassement en rouge |

> Le concept **Équipe** (tables `equipes` + `tache_equipe`, 2 routers, 12 endpoints, 3 pages, migration `0005`)
> **n'apparaît nulle part dans `docs/SPEC.md` ni dans `README.md`** (0 occurrence). C'est le plus gros
> écart spec↔code du projet. Voir chantier **C2**.

**Absent aussi** : aucune route 404 (une URL inconnue rend une zone vide).

---

## 3. Modèle de données

11 tables. Tous les modèles héritent de `TimestampMixin` (`created_at`/`updated_at`).

| Table | PK | Rôle |
|---|---|---|
| `users` | `id` | `role` = admin\|membre, `actif` |
| `epics` | **`trigramme`** (str(3), clé naturelle) | + `couleur`, `statut`, `categorie` |
| `projects` | `id` | FK → epic (CASCADE) |
| `tasks` | `id` | FK → project (CASCADE), `statut` = ouvert\|archive |
| `milestones` | `id` | plus aucun FK direct depuis `0008` |
| `milestone_project` | (`milestone_id`,`project_id`) | **N-N** jalon ↔ projet |
| `dependencies` | `id` | amont/aval + type FS\|SS\|FF |
| `measures` | `id` | FK → epic |
| `equipes` | `id` | `temps_dispo_hebdo` |
| `tache_equipe` | `id` | **N-N + payload** `heures_allouees` |

### Points de fragilité

- **`updated_by_id` n'est FK vers rien.** Présent sur 8 tables comme simple `Integer`, sans contrainte
  référentielle (ni modèle, ni migration). Supprimer un user laisse des ids pendants. INV-21 repose dessus.
- **`UserRead` expose un `updated_by_id` toujours `null`** : le schéma hérite de `TimestampedRead` mais
  la table `users` n'a pas cette colonne.
- **Supprimer un projet peut violer INV-6 en silence** : le CASCADE sur `milestone_project` peut laisser
  un jalon à zéro projet. Aucune contrainte DB, aucune revalidation dans `delete_project`.
  La migration `0008` documente déjà ce cas d'orphelins (jalons d'un epic sans projet).
  Un jalon orphelin devient **inéditable** via `PUT` (le check exige ≥1 projet).
- **Aucune relation ORM sur `tache_equipe`** (`Task.equipes` / `Equipe.taches` n'existent pas) → jointures manuelles.
- `Milestone.projects` est **unidirectionnel** (pas de `back_populates`).

---

## 4. Surface API

**42 handlers**, 10 routers, tous préfixés `/api/*` dans leur propre module (`main.py` monte sans préfixe).
Le proxy passe `/api/` **sans réécriture** — cohérent par construction.

| Ouvert | Admin uniquement | Authentifié (tout membre) |
|---|---|---|
| `POST /api/auth/login`, `GET /api/health` | `POST`/`PUT`/`DELETE /api/users/{id}` (3) | **les 37 autres** |

### Constats

- **RBAC quasi inexistant** : `require_admin` ne garde que la gestion des users. **Tout membre actif peut
  créer/modifier/supprimer n'importe quel epic, projet, tâche, jalon, dépendance, mesure, équipe** — aucun
  contrôle d'appartenance ni de `responsable_id`. `GET /api/users` n'est pas gaté : tout membre énumère les users.
- Le claim `role` du JWT est **décoratif** : posé au login, jamais relu (`require_admin` relit la DB — correct,
  mais le claim est mort).
- `POST /api/auth/login` consomme du **JSON**, alors que `OAuth2PasswordBearer(tokenUrl=...)` annonce un
  endpoint form-encodé → **le bouton « Authorize » de Swagger ne fonctionne pas** contre lui.
- **CORS `allow_origins=["*"]` + `allow_credentials=True`** : combinaison invalide, rejetée par les navigateurs.
- Verbes manquants : pas de `PUT` sur `dependencies` (assumé) ; pas de `GET /{id}` sur users, milestones,
  measures, tache-equipe → le front récupère la collection entière pour trouver une ligne.
- Pas de refresh token (la SPEC §6 en prévoit un).

---

## 5. Invariants — le cœur du sujet

**29 IDs déclarés, 4 retirés, 25 actifs — ~~1~~ 25 testés (phase 2 faite, chantier C3).**
*(Les 5 `INV-EQ-*` ont été nommés par la SPEC v0.2 ; ils étaient déjà appliqués, mais anonymes.)*

`U` = test unitaire sur la fonction · `A` = test d'intégration via l'API · `H` = propriété Hypothesis.

| ID | Fonction `check_*` | Appelée par | Testé |
|---|---|---|---|
| INV-1 | `check_epic_trigramme` (regex **seule** ; l'unicité est portée par la PK + un 409 inline) | `epics.py:26` | U A H |
| INV-2 / INV-3 | `check_epic_basics` | `epics.py:27` | U A |
| INV-4 / INV-5 | *aucune* — 409 + code en ligne dans la route | `tasks.py`, `projects.py` | A |
| INV-6 | `check_milestone_has_projects` | `milestones.py:37` | U A + **1 xfail** (orphelinage) |
| INV-7 | `check_task_dates` | `tasks.py:30` | U A H |
| INV-8 | `check_project_dates` | `projects.py:31` | U A H |
| **INV-9** | ~~`check_task_dates_within_project`~~ **purgée (étape 0)** | — | A *(vérifie que la mutation est ACCEPTÉE)* |
| INV-10 | `check_project_dates_within_epic` | `projects.py:32` | U A |
| INV-11 | `check_milestone_within_epic_max` | `milestones.py:46` | U A |
| INV-12 | `check_epic_date_order` | `epics.py:28` | U A |
| **INV-13** | ~~`check_dependency_dates`~~ **purgée (étape 0)** | — | A *(vérifie que la mutation est ACCEPTÉE)* |
| **INV-14** | `check_dependency_acyclic` | `dependencies.py:50` | U A **H (oracle de Kahn)** |
| INV-15 | `check_dependency_no_self` (+ `CheckConstraint` DB) | `dependencies.py:48` | U A H |
| **INV-16 / INV-17** | *supprimées avec le champ `avancement` (`0007`)* | — | — |
| INV-18 | `check_project_realise_consistency` | `projects.py:35` | U A |
| INV-19 | `check_epic_realise_consistency` | `epics.py:45` | U A |
| INV-20 | `check_measure_unit_consistency` | `measures.py:47,79` | U A |
| INV-21 | *aucune* — audit fait à la main dans 8 routers | — | A |
| INV-AUTH-1 | *aucune* — `func.lower(email)` inline, 409 + code | `users.py:58,93` | A + **1 xfail** (domaine `.local`) |
| INV-AUTH-2 | `check_max_active_users` | `users.py:24` | U H |
| INV-AUTH-3 | `check_min_one_admin` | `users.py:25,128` | U A |
| INV-EQ-1a | `check_equipe_nom` *(C10)* | `equipes.py::_validate` | U A H |
| INV-EQ-1b | `check_equipe_nom_unique` *(C10)* | `equipes.py::_validate` | U A H |
| INV-EQ-2 | `check_equipe_temps_dispo` *(C10)* | `equipes.py::_validate` — 422 par le schéma en pratique, comme INV-1 | U A H |
| INV-EQ-3 | `check_allocation_heures` *(C10)* | `tache_equipe.py` — idem 422 | U A |
| INV-EQ-4 | `check_allocation_unique` *(C10)* | `tache_equipe.py::create` | U A |
| INV-EQ-5 | `check_allocation_refs` *(C10)* | `tache_equipe.py::create` | U A |

> **✅ Résolu par C10 (2026-07-17).** Les `INV-EQ-*` étaient appliqués mais **anonymes** :
> `equipes.py` et `tache_equipe.py` étaient les seuls routers à n'importer ni `app.invariants` ni
> `http_from_invariant`, et levaient des `HTTPException(409, "chaîne libre")`. Les six codes sont
> désormais câblés (vérifié de bout en bout, 14/14). Deux corrections au passage : `INV-EQ-1a`
> refuse enfin `nom="   "` (accepté en 201 auparavant) et le nom est trimmé à l'écriture ;
> `INV-EQ-5` renvoie 409 + code au lieu de 404, par alignement sur INV-4.
>
> Corrigé aussi : `app/invariants/__init__.py` ne ré-exportait que 15 des 18 fonctions de
> `checks.py` — d'où une **convention d'import à deux portes**, les routes contournant le trou en
> important depuis `app.invariants.checks`. C'est exactement ce motif qui avait cassé la CI. Tout
> est désormais exporté. *(Reste cosmétique : 6 routes importent encore par `app.invariants.checks`.)*

**Code mort à retirer** : `check_task_dates_within_project` (INV-9, retiré de la SPEC mais lèverait encore
si on l'appelait) et `check_dependency_dates` (INV-13, no-op). Ce dernier est **coûteux** : dans
`tasks.py::_validate`, il est appelé dans une boucle qui fait un `SELECT` sur les dépendances **plus un
`db.get(Task, …)` par arête** — de l'I/O DB à chaque create/update de tâche, uniquement pour alimenter une
fonction qui jette ses arguments.

**Bonne base à conserver** : les checks sont purs, sans état, typés par `Protocol` — les tests pourront leur
passer de simples dataclasses sans monter SQLAlchemy. C'est exactement ce qu'il faut pour la phase 2.

---

## 6. Tests & CI

### 🔴 La CI n'a jamais été verte — pas une fois en 66 commits *(corrigé en étape 0)*

Le job `api` enchaîne **Ruff puis pytest** (`ci.yml:24-27`). Il échouait **dès l'étape Ruff**, donc
**pytest n'était jamais atteint**. Vérifié en extrayant le tout premier commit `d8e28bc` — celui qui a
introduit à la fois le code et la CI — et en y lançant le lint : **79 erreurs**. Sur `e260851` : **134**.

Le gros du volume était structurel, pas du laisser-aller :
- **82 × `B008`** = un faux positif sur chaque `= Depends(...)`, l'idiome d'injection normal de FastAPI.
  `select = ["B"]` sans `extend-immutable-calls` ⇒ rouge garanti dès la première ligne de route écrite.
- **41** dans `alembic/versions/` = boilerplate de migration généré (`Union[str, None]`, imports non triés).

Derrière cette panne s'en cachait une seconde, jamais atteinte : `api/tests/test_smoke.py:10` importait
`check_task_advancement_status`, **supprimée** avec INV-16/17 au commit `1167e9e` →
`ImportError: cannot import name 'check_task_advancement_status'`. Ironie : le test qui cassait est
`test_imports_ok`, dont la docstring dit *« Vérifie que les modules s'importent (CI ne casse pas avant
phase 2) »*.

Comme `docker` déclare `needs: [api, web]`, **les trois images annoncées par le README n'ont jamais été
construites par la CI**.

**État après étape 0** : `ruff check .` → *All checks passed* · `pytest -q` → *2 passed*.

### Couverture — avant / après la phase 2 (chantier C3)

**Avant** : 2 fonctions de test. L'une (`test_imports_ok`) n'avait **aucune assertion** et était
cassée ; l'autre couvrait INV-14. → **1 invariant actif sur 25.** Zéro test d'intégration, zéro
fixture, pas de `conftest.py`. `hypothesis` et `httpx` étaient déclarés en dev-deps et **jamais
importés**.

**Après** : **183 tests + 2 xfail**, les 25 invariants actifs couverts. `test_smoke.py` est retiré —
il annonçait lui-même être un placeholder « avant phase 2 ».

| Fichier | Contenu |
|---|---|
| `tests/test_invariants_unit.py` | 121 tests sur les fonctions `check_*`, cas valides **et** invalides. Aucune dépendance à SQLAlchemy : les checks sont purs et typés par `Protocol`, on leur passe des dataclasses — l'intention posée dès l'origine par la docstring de `checks.py`. |
| `tests/test_invariants_api.py` | 47 tests d'intégration. Prouvent que **la route appelle réellement** le check et surface le bon code. Seul chemin possible pour INV-4, INV-5, INV-AUTH-1 et INV-21, qui n'ont pas de fonction dédiée. |
| `tests/test_invariants_hypothesis.py` | 14 propriétés. Cœur : INV-14 confronté à un **oracle indépendant** (algorithme de Kahn) sur des centaines de graphes générés. |
| `tests/test_couverture_invariants.py` | Garde-fou : échoue si un `InvariantError("INV-…")` apparaît sans test qui le cite, ou si un test attend un code que plus personne ne lève. |
| `tests/conftest.py` | SQLite en mémoire + `TestClient`. L'auth n'est **pas** court-circuitée : vrai admin, vrai `POST /api/auth/login`, vrai JWT. |

**Chaque test invalide assert le code `INV-X`**, pas seulement le statut HTTP : l'ID stable est le
contrat entre la SPEC, l'API et le client.

**La suite détecte-t-elle vraiment une régression ?** Vérifié par tests de mutation : 8 invariants
cassés un à un dans `checks.py` (retrait du trim, `>` → `>=`, détection de cycle désactivée…),
**8/8 rattrapés**. Une suite qui passe ne prouve rien ; une suite qui tue ses mutants, si.

**Portée assumée** : les tests d'intégration tournent sur **SQLite en mémoire**, pas sur PostgreSQL.
Ce qui est éprouvé, c'est l'application des invariants par les *routes* — du Python, identique quel
que soit le moteur. En contrepartie, la dernière ligne de défense (contraintes `CHECK` en base) n'est
pas couverte : il faudrait un service PostgreSQL en CI. Arbitrage, pas oubli.

**Deux défauts encodés en `xfail(strict=True)`** plutôt que laissés dans un coin de document. Le
jour où ils sont corrigés, le test passe au vert, `strict=True` transforme ça en échec, et le
marqueur *doit* être retiré. Un défaut connu qui ne peut pas être oublié :
1. **INV-6 — orphelinage.** Supprimer un projet peut laisser un jalon sans aucun projet, qui devient
   alors inéditable (cf. R8).
2. **`.local` refusé à la création d'utilisateur** — voir ci-dessous.

> **Nouveau défaut trouvé en écrivant les tests.** `UserCreate.email` est un `EmailStr`, et
> `email-validator` **rejette les domaines réservés** comme `.local` → `POST /api/users` renvoie 422.
> Or `.env.example` impose `SEED_ADMIN_EMAIL=charles@lesfontaines.local`. La seed écrit en base
> directement (donc passe) et `LoginRequest.email` est un `str` nu (donc la connexion marche) :
> **l'application ne sait pas créer un compte suivant sa propre convention.** Concrètement, impossible
> d'ajouter un second utilisateur en `@lesfontaines.local` depuis l'UI. Chantier **C11**.

### Écarts README ↔ CI réelle

| Annoncé | Réel |
|---|---|
| « à chaque push » | **Il n'y a plus de déclencheur `push` du tout** — voir ci-dessous. |

> **Évolution du déclencheur, en deux temps.**
>
> *Premier temps (C1).* J'avais listé « élargir `push:` au-delà de `main` » comme reste-à-faire, puis
> je suis revenu dessus : `push: [main]` + `pull_request` est le motif standard, et l'élargir aurait
> fait tourner la CI sur chaque push de travail en cours, avec un signal en double sur les branches
> de PR. Ce qui a manqué pendant 66 commits n'était pas la config, c'est qu'**aucune PR n'a jamais
> été ouverte** (la #1 est la première du dépôt).
>
> *Second temps (C13).* Le déclencheur `push` est **entièrement retiré**. La logique se tient dès lors
> que `main` est protégée : tout ce qui y entre passe par une PR, donc a déjà été testé, et le rejouer
> sur le commit de merge fait doublon. **Le mode *strict* des status checks est la clé** — il impose
> que la branche soit à jour avant merge, ce qui garantit que l'état testé par la PR **est** l'état
> fusionné. Sans lui, la PR pourrait être verte sur une base périmée et casser `main` en fusionnant.
>
> ⚠️ **La protection n'est pas en place** : `main` n'a aujourd'hui **aucune** règle
> (`GET /branches/main/protection` → 404), et le compte utilisé n'est pas administrateur du dépôt
> (`permissions.admin: false`), donc ne peut pas la poser. **Il y a donc une fenêtre** où `main`
> n'est ni protégée ni couverte par la CI en cas de push direct. Chantier **C13** ci-dessous : à
> faire poser par un administrateur.
>
> Ajoutés par ailleurs : `workflow_dispatch` (déclenchement manuel) et un groupe `concurrency`
> (un nouveau push annule l'exécution précédente au lieu de faire la queue).
| ruff + pytest | vrai — mais pytest est rouge |
| build des 3 images | **ne s'exécute pas** (bloqué par `needs`) |
| job « Web — lint + build » | **ne linte jamais** : pas d'étape lint |

- `npm run lint` **ne peut pas fonctionner** : ESLint 9 est installé avec 3 plugins mais **aucun fichier de
  config n'existe** (ni `.eslintrc*`, ni `eslint.config.js`), et `--ext` a été retiré en v9.
- **Aucun `package-lock.json`** → `npm ci || npm install` échoue puis retombe silencieusement sur `npm install` :
  CI et image web **non reproductibles** (les `^` flottent à chaque build).
- Pas de `ruff format`/`black --check`, pas de couverture, pas de test `docker compose up`, pas de cache.

---

## 7. Écarts SPEC ↔ code

> **Résolu par la SPEC [v0.2](docs/SPEC.md) (chantier C2).** Ce tableau décrit l'état constaté au
> commit `e260851`. La SPEC documente désormais les Équipes, leurs 5 invariants, les non-invariants
> délibérés, le statut de livraison de chaque écran, et les écarts §6/§8. Il est conservé ici comme
> trace de ce qui a motivé la révision.

| Sujet | SPEC (v0.1) | Code |
|---|---|---|
| **Équipes** | **absent** → ✅ documenté en v0.2 (`INV-EQ-1..5`) | 2 tables, 12 endpoints, 3 pages, 1 migration |
| **Mesures (CRUD + courbe)** | écrans 8 & 9 → statut ❌/🟡 explicité en v0.2 | API complète, **UI lecture seule**, pas de courbe |
| **Paramètres / Backup** | écran 11 → statut ❌ explicité en v0.2 | inexistant |
| **Refresh token** | §6 | non implémenté |
| ~~**Rôles**~~ | ~~admin / membre distincts~~ | **Pas un écart — erreur de la v1 de ce document.** La SPEC §6 dit littéralement « `membre` (CRUD métier sans gestion users) » : un membre a bien tout le CRUD métier. Le code est **conforme**. Voir R4. |
| **CI** | ruff + **black**, **eslint** + tsc, pytest, docker | ni black, ni eslint |
| **Lib Gantt** | `gantt-task-react` « à confirmer » | confirmé, `^0.3.9` |
| **SS / FF** | types de dépendance légitimes | **jamais dessinés** sur le Gantt (`continue` si `!== "FS"`) — créables mais invisibles |
| **INV-9** | « supprimé, hachure rouge côté UI » | hachure ✅ présente ; fonction morte laissée dans `checks.py` |

---

## 8. Dette & risques classés

| # | Risque | Gravité | Détail |
|---|---|---|---|
| ~~R1~~ | ~~**CI rouge**~~ | ✅ **résolu (étape 0)** | Était rouge depuis le commit initial, à l'étape lint (§6). `ruff check .` et `pytest -q` passent désormais. |
| R2 | **Dérive modèles ↔ migrations** | 🟠 | `alembic check` échoue sur **3 points** : la migration `0008` crée `ix_milestone_project_milestone_id` et `ix_milestone_project_project_id` (l. 41-42) que le `Table` du modèle **ne déclare pas** ; et `user.py:19` (`unique=True, index=True`) diverge de la contrainte `users_email_key` posée par `0001`. Un `alembic revision --autogenerate` émettrait donc du **churn d'index** — suppression de deux index qui portent les jointures N-N, réécriture de l'unicité email. Pas de perte de données. |
| ~~R3~~ | ~~**1 invariant testé sur 20**~~ | ✅ **résolu (C3)** | Les 25 invariants actifs sont couverts : 183 tests + 2 xfail, sur 3 couches (unitaire, API, Hypothesis), plus un garde-fou de couverture. Suite éprouvée par mutation : 8/8. |
| R4 | **RBAC : tout membre peut tout détruire** | 🟡 | 3 endpoints gardés par `require_admin` sur 40. **Conforme à la SPEC §6** (« membre : CRUD métier sans gestion users ») — la v1 de ce document le présentait à tort comme un écart. Reste une question de **conception**, pas de conformité : est-il voulu qu'un membre puisse supprimer un epic entier ? Y toucher serait un changement de besoin, à trancher dans la SPEC avant d'être codé. Seul écart réel : `GET /api/users` n'est pas gaté admin. |
| R5 | **Gantt couplé au DOM de la lib** | 🟠 | mapping **par index DOM** entre `svg g[tabindex]` et le tableau de tâches (poignées, décorations, flèches). Un changement d'ordre de rendu de `gantt-task-react` → **suppression de la mauvaise dépendance**, en silence. Sélecteurs internes (`g[class~="arrow"]`), détection d'« aujourd'hui » en cherchant la chaîne `"255, 152, 0"` dans un `fill`. 3 `setInterval` permanents (250/300/500 ms). |
| R6 | **Backup tolère la corruption** | 🟠 | `pg_dump \| gzip` sous `sh` **sans `pipefail`** : un dump en échec écrit un `.sql.gz` tronqué **compté comme réussi**. Rétention purement par âge, **sans plancher de copies** : une panne > 30 j + un passage de cron ⇒ **zéro backup**. Aucune vérification de restore, aucune copie hors-volume. |
| R7 | **Pas de lockfile npm** | 🟠 | builds non reproductibles |
| R8 | **Jalons orphelins** | 🟠 | violent INV-6 en silence et deviennent inéditables (§3) |
| R9 | **`GanttPage.tsx` = 2332 lignes** | 🟡 | **plus gros que tout le backend Python (2306 l.)**, 34 % du front. Composant monolithique, 8 refs miroir d'état pour contourner les effets à deps vides. |
| R10 | **Aucun refetch ciblé** | 🟡 | chaque mutation du Gantt relance **7 requêtes** ; pas de cache, pas d'optimistic update |
| R11 | `docs/RESTORE.md` : `psql -U postgres` | 🟡 | le rôle réel est `${POSTGRES_USER}` (= `gestion`) → **la commande de restore documentée échoue** |
| R12 | `scripts/` non lintés, deps non déclarées | 🟡 | `requests`, `openpyxl`, `playwright` absents de `pyproject.toml` ; port par défaut `8088` ≠ `8080` réel |
| R13 | Code mort | 🟡 | ~~INV-9/INV-13 (§5)~~ ✅ purgés en étape 0, ~~`Boolean` (epic)~~ ✅ retiré par `ruff --fix` — restent : `_slug()` (seed), `nav`/`navState` (GanttPage), `equipes.get` |

### Faux positif écarté

**`alembic/env.py` n'importe pas `app.models.equipe`** — signalé en première version comme un risque 🔴 de
perte de données (`autogenerate` émettrait `drop_table("equipes")`). **C'est faux** : `env.py` fait
`from app.models import (...)`, ce qui exécute `app/models/__init__.py`, lequel importe **tous** les modèles
dont `Equipe`/`TacheEquipe` (l. 3). Les tables sont donc bien dans `Base.metadata` quoi qu'il arrive.
Vérifié par contre-factuel : en retirant l'import d'`equipe` d'`env.py`, `alembic check` **n'émet aucun
`remove_table`**. L'import explicite a tout de même été complété en étape 0 (ceinture-bretelles : il resterait
correct si `models/__init__.py` était un jour allégé), mais ce n'était **pas** un correctif de bug.

---

## 9. Chantiers ouverts (suivi)

| Id | Chantier | Pourquoi | Effort |
|---|---|---|---|
| **C1** | ✅ **Fait (2026-07-17).** Étape 0 (lint + tests verts) puis : `eslint.config.js` plate créée — le job « Web — lint + build » **linte enfin** ; `package-lock.json` commité et `npm ci` sans repli ; `concurrency` + `workflow_dispatch` ; `*.tsbuildinfo` ignoré. Code mort du front retiré (`nav`, `navState`) + 2 directives `eslint-disable` mensongères. **Reste** : 7 warnings de lint documentés ci-dessous. | Rien n'est fiable tant que la CI ment | ~~XS~~ → M |
| **C2** | ✅ **Fait (SPEC v0.2, 2026-07-17).** Équipes documentées + 5 invariants `INV-EQ-*`, non-invariants délibérés consignés, statut de livraison par écran, retraits INV-9/13/16/17 entérinés, écarts §6/§8 actés. **Découvert au passage** : les routers Équipe sont les seuls à ne pas passer par `app.invariants` — leurs violations ne remontent **aucun code** `INV-EQ-*`. Prérequis de C3, voir C10. | La spec est la référence de la phase 2 ; elle était fausse | S |
| **C3** | ✅ **Fait (2026-07-17) — phase 2.** 183 tests + 2 xfail, les 25 invariants actifs couverts sur 3 couches (unitaire / API / Hypothesis) + un garde-fou de couverture. `test_smoke.py` retiré. Suite validée par mutation (8/8). 2 défauts encodés en `xfail(strict=True)`. **Reste** : les tests d'intégration tournent sur SQLite, pas PostgreSQL — les contraintes en base ne sont pas couvertes. | Le cœur métier n'était pas protégé | L |
| **C10** | ✅ **Fait (2026-07-17).** 6 fonctions `check_*` ajoutées + câblées via `http_from_invariant` dans les 2 routers Équipe. Défaut `INV-EQ-1a` corrigé, `INV-EQ-5` aligné sur INV-4 (409+code). Exports d'`app.invariants` complétés (15→18+6). Vérifié 14/14. | Sans code stable, la règle « 1 test par `INV-X` » était inapplicable aux Équipes | S |
| **C11** | **Domaine `.local` refusé à la création d'utilisateur** : `UserCreate.email` est un `EmailStr` et `email-validator` rejette les TLD réservés, alors que `.env.example` impose `charles@lesfontaines.local`. Piste : `EmailStr` avec `test_environment=True`, ou un validateur maison. Un `xfail(strict=True)` garde la trace. | L'app ne sait pas créer un compte suivant sa propre convention | S |
| **C12** | **Faire tomber les contraintes base en CI** : les tests d'intégration tournent sur SQLite, donc les `CheckConstraint` et l'unicité PostgreSQL ne sont pas éprouvées. Ajouter un service `postgres` au job `api` + `alembic upgrade head` (couvrirait aussi C5 via `alembic check`). | La dernière ligne de défense n'est pas testée | M |
| **C13** | 🔴 **Protéger `main` — à faire poser par un administrateur.** Le déclencheur `push` de la CI a été retiré ; ce choix ne tient que si `main` est protégée. Aujourd'hui elle ne l'est pas du tout, et le compte disponible n'est pas admin du dépôt. **Fenêtre ouverte** : un push direct sur `main` n'est ni bloqué, ni testé. Réglage exact ci-dessous. | Sans protection, retirer `push:` laisse `main` sans filet | XS *(mais bloqué)* |

### C13 — réglage à demander à l'administrateur

Le dépôt est **public** et `main` n'a aucune règle. À poser dans
*Settings → Branches → Add branch protection rule*, sur `main` :

| Réglage | Valeur | Pourquoi |
|---|---|---|
| Require a pull request before merging | ✅ | C'est **le** réglage qui bloque les push directs. |
| Required approving reviews | **0** | ⚠️ Mettre 1 verrouillerait le dépôt : GitHub interdit d'approuver sa propre PR, et l'équipe tient sur une personne. |
| Require status checks to pass | ✅ | Les 3 contextes, au caractère près (ils contiennent un tiret cadratin) : `API — lint + tests`, `Web — lint + build`, `Docker — build images` |
| **Require branches to be up to date** (*strict*) | ✅ | **Le réglage critique.** C'est lui qui rend le retrait du déclencheur `push` légitime : il garantit que l'état testé par la PR **est** l'état fusionné. |
| Allow force pushes / deletions | ❌ | |
| Include administrators | au choix | Le laisser décoché garde une issue de secours en cas d'urgence. |

Équivalent en ligne de commande, pour un compte administrateur :

```bash
gh api -X PUT repos/Murgat-Ingenierie/projets9/branches/main/protection --input - <<'JSON'
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["API — lint + tests", "Web — lint + build", "Docker — build images"]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": {"required_approving_review_count": 0},
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
JSON
```
| **C4** | **Peupler le Gantt** : la vue centrale est vide à l'install, sans chemin supporté | Le produit ne démontre rien au premier lancement | M |
| **C5** | Réconcilier modèles ↔ migrations (R2) : déclarer les index de `milestone_project`, aligner l'unicité `users.email`, puis viser `alembic check` vert en CI | `autogenerate` produit aujourd'hui du churn d'index | S |
| **C6** | Fiabiliser le backup : `pipefail`, plancher de copies, test de restore, corriger `RESTORE.md` | Un backup non vérifié n'est pas un backup | S |
| **C7** | Durcir le RBAC (R4) | Écart à la SPEC §6 | M |
| **C8** | Écrans manquants : CRUD Mesures + courbe, Paramètres/Backup | SPEC §4 incomplet | M |
| **C9** | Dégraisser `GanttPage.tsx` / réduire le couplage DOM (R5, R9) | Zone la plus fragile et la plus active du dépôt | L |
