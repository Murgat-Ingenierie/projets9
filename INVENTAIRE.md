# Inventaire de l'existant

> **Établi le** : 2026-07-17 · **Commit** : `e260851` · **Branche** : `claude/project-setup-inventory-95cf59`
> **Méthode** : lecture exhaustive du code + stack démarrée et vérifiée en local (Docker Compose).
> **Objet** : photographier l'écart entre `docs/SPEC.md` (spec figée le 2026-05-19), `README.md`, et le code réel,
> pour servir de base de suivi avant la phase 2.
>
> Ce document est un instantané. À réactualiser quand les chantiers du §9 avancent.
>
> **MàJ 2026-07-17 — chantiers C1 (étape 0) et C2 appliqués.** Voir §1 et la SPEC
> [v0.2](docs/SPEC.md). **Trois** affirmations de la première version de ce document étaient
> fausses et sont corrigées ici :
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

C'est la matière de la phase 2. **29 IDs déclarés, 4 retirés, 25 actifs — 1 seul testé.**
*(Les 5 `INV-EQ-*` ont été nommés par la SPEC v0.2 ; ils étaient déjà appliqués, mais anonymes.)*

| ID | Fonction `check_*` | Appelée par | Testé |
|---|---|---|---|
| INV-1 | `check_epic_trigramme` (regex **seule** ; l'unicité est portée par la PK + un 409 inline) | `epics.py:26` | ❌ |
| INV-2 / INV-3 | `check_epic_basics` | `epics.py:27` | ❌ |
| INV-4 / INV-5 | *aucune* — délégué aux FK | — | ❌ |
| INV-6 | `check_milestone_has_projects` | `milestones.py:37` | ❌ |
| INV-7 | `check_task_dates` | `tasks.py:30` | ❌ |
| INV-8 | `check_project_dates` | `projects.py:31` | ❌ |
| **INV-9** | `check_task_dates_within_project` | **jamais appelée → code mort** | ❌ |
| INV-10 | `check_project_dates_within_epic` | `projects.py:32` | ❌ |
| INV-11 | `check_milestone_within_epic_max` | `milestones.py:46` | ❌ |
| INV-12 | `check_epic_date_order` | `epics.py:28` | ❌ |
| **INV-13** | `check_dependency_dates` → **`return  # no-op`** | `tasks.py:48`, `dependencies.py:51` | ❌ |
| **INV-14** | `check_dependency_acyclic` | `dependencies.py:50` | ✅ **le seul** |
| INV-15 | `check_dependency_no_self` (+ `CheckConstraint` DB) | `dependencies.py:48` | ❌ |
| **INV-16 / INV-17** | *supprimées avec le champ `avancement` (`0007`)* | — | ⚠️ voir §6 |
| INV-18 | `check_project_realise_consistency` | `projects.py:35` | ❌ |
| INV-19 | `check_epic_realise_consistency` | `epics.py:45` | ❌ |
| INV-20 | `check_measure_unit_consistency` | `measures.py:47,79` | ❌ |
| INV-21 | *aucune* — audit fait à la main dans 8 routers | — | ❌ |
| INV-AUTH-1 | *aucune* — `func.lower(email)` inline | `users.py:58,93` | ❌ |
| INV-AUTH-2 | `check_max_active_users` | `users.py:24` | ❌ |
| INV-AUTH-3 | `check_min_one_admin` | `users.py:25,128` | ❌ |
| INV-EQ-1a | **non appliqué** — `Field(min_length=1)` ne trim pas : `nom="   "` accepté (vérifié, 201) | — | ❌ |
| INV-EQ-1b | *aucune* — `func.lower(nom)` inline, **409 sans code** | `equipes.py:33,59` | ❌ |
| INV-EQ-2 | *aucune* — Pydantic `Field(ge=0)` + `CheckConstraint` | `schemas/equipe.py:8,13` | ❌ |
| INV-EQ-3 | *aucune* — Pydantic `Field(gt=0)` + `CheckConstraint` | `schemas/equipe.py:25,29` | ❌ |
| INV-EQ-4 | *aucune* — requête inline, **409 sans code** | `tache_equipe.py:34` | ❌ |
| INV-EQ-5 | *aucune* — `db.get` + 404 inline | `tache_equipe.py:30,32` | ❌ |

> **Les 5 `INV-EQ-*` sont appliqués mais anonymes.** `equipes.py` et `tache_equipe.py` sont les
> **seuls routers à n'importer ni `app.invariants` ni `http_from_invariant`** : ils lèvent des
> `HTTPException(409, "Nom d'équipe déjà utilisé")` — une chaîne libre, là où tout le reste du
> code renvoie `{"code": "INV-X", "message": …}`. Côté front, `ErrorBanner` affiche `[CODE] message`
> quand le code existe : les erreurs Équipe s'affichent donc sans code. Tant que ce n'est pas câblé
> (**chantier C10**), la règle du README « chaque `INV-X` donne lieu à au moins un test » est
> inapplicable aux Équipes.

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

### Couverture réelle

- **2 fonctions de test au total.** L'une (`test_imports_ok`) n'a **aucune assertion** et est cassée.
  L'autre couvre INV-14. → **1 invariant actif sur 20.**
- **0 test front** (aucun runner installé), **0 test d'intégration API**, 0 fixture, pas de `conftest.py`.
- `hypothesis`, `httpx`, `black` sont **déclarés en dev-deps et jamais importés**. `pytest-asyncio` est
  configuré (`asyncio_mode="auto"`) sans aucun test async.

### Écarts README ↔ CI réelle

| Annoncé | Réel |
|---|---|
| « à chaque push » | `push` **limité à `main`** ; ailleurs seulement si une PR est ouverte |
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
| R3 | **1 invariant testé sur 20** | 🔴 | cœur du produit non protégé ; c'est l'objet de la phase 2 |
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
| **C1** | 🟡 **En cours.** ✅ *Étape 0 faite : lint + tests verts (§1).* **Reste** : config ESLint (le job « Web — lint + build » ne linte pas, et `npm run lint` est inexécutable), `package-lock.json` (`npm ci \|\| npm install` masque l'échec), élargir `push:` au-delà de `main` | Rien n'est fiable tant que la CI ment | ~~XS~~ → M |
| **C2** | ✅ **Fait (SPEC v0.2, 2026-07-17).** Équipes documentées + 5 invariants `INV-EQ-*`, non-invariants délibérés consignés, statut de livraison par écran, retraits INV-9/13/16/17 entérinés, écarts §6/§8 actés. **Découvert au passage** : les routers Équipe sont les seuls à ne pas passer par `app.invariants` — leurs violations ne remontent **aucun code** `INV-EQ-*`. Prérequis de C3, voir C10. | La spec est la référence de la phase 2 ; elle était fausse | S |
| **C3** | **Phase 2 — tests d'invariants** (l'objectif annoncé du README) : **24 invariants actifs** à couvrir (19 restants + 5 `INV-EQ-*`), unitaire + intégration + Hypothesis | Le cœur métier n'est pas protégé | L |
| **C10** | **Câbler les codes `INV-EQ-*`** : `check_*` dans `app.invariants` + `http_from_invariant` dans les 2 routers Équipe, à la place des `HTTPException(409, "chaîne")` | Sans code stable, la règle « 1 test par `INV-X` » est inapplicable aux Équipes | S |
| **C4** | **Peupler le Gantt** : la vue centrale est vide à l'install, sans chemin supporté | Le produit ne démontre rien au premier lancement | M |
| **C5** | Réconcilier modèles ↔ migrations (R2) : déclarer les index de `milestone_project`, aligner l'unicité `users.email`, puis viser `alembic check` vert en CI | `autogenerate` produit aujourd'hui du churn d'index | S |
| **C6** | Fiabiliser le backup : `pipefail`, plancher de copies, test de restore, corriger `RESTORE.md` | Un backup non vérifié n'est pas un backup | S |
| **C7** | Durcir le RBAC (R4) | Écart à la SPEC §6 | M |
| **C8** | Écrans manquants : CRUD Mesures + courbe, Paramètres/Backup | SPEC §4 incomplet | M |
| **C9** | Dégraisser `GanttPage.tsx` / réduire le couplage DOM (R5, R9) | Zone la plus fragile et la plus active du dépôt | L |
