# Spécification — Gestionnaire de projet (Phase 1)

Version : 0.1 — figée le 2026-05-19
Statut : définition du besoin (avant v0)

## 1. Objectif

Application web de gestion de projet pour la pisciculture Les Fontaines.
Vue centrale : **planning Gantt** sur 3 niveaux hiérarchiques.
Multi-utilisateurs (max 10), self-hostée (local puis serveur pisci).

Source de données initiale : `Liste des projets en cours - Epic.csv` (utilisée
uniquement pour le **peuplement** initial de la base via une *seed* — pas
d'endpoint d'import dans l'application).

## 2. Modèle de données

### Hiérarchie

```
Epic ──< Projet ──< Tâche
Epic >── Jalon ──< Epic      (relation N-N : un jalon peut être rattaché à plusieurs epics)
Tâche >── Dépendance ──< Tâche   (DAG global, cross-projet et cross-epic autorisé)
Epic ──< Mesure                  (suivi du critère de réussite)
User                              (responsable de Projet ou Tâche)
```

### Entités

#### Epic
| Champ | Type | Notes |
|---|---|---|
| `trigramme` | str(3) | PK, [A-Z0-9]{3}, lisible (O50, RDR, FAB…) |
| `nom` | str | obligatoire |
| `critère_réussite` | text | obligatoire si statut=actif |
| `raison_date_fin` | text | optionnel |
| `date_fin_prévue` | date | optionnel |
| `jalon_fin_max` | date | optionnel, borne dure |
| `statut` | enum | `idée` \| `actif` \| `réalisé` \| `abandonné` |
| `catégorie` | enum | `opérationnel` \| `stratégique` \| `long_terme` |
| `couleur` | str(7) | optionnel, hex `#RRGGBB`, utilisée sur le Gantt |

#### Projet
| Champ | Type | Notes |
|---|---|---|
| `id` | int | PK |
| `epic_trigramme` | str(3) | FK → Epic |
| `nom` | str | obligatoire |
| `description` | text | optionnel |
| `date_début` | date | obligatoire |
| `date_fin` | date | obligatoire |
| `statut` | enum | `prévu` \| `en_cours` \| `réalisé` \| `abandonné` |
| `responsable_id` | int | FK → User, optionnel |

#### Tâche
| Champ | Type | Notes |
|---|---|---|
| `id` | int | PK |
| `projet_id` | int | FK → Projet |
| `nom` | str | obligatoire |
| `date_début` | date | obligatoire |
| `date_fin` | date | obligatoire |
| `responsable_id` | int | FK → User, optionnel |
| `statut` | enum | `ouvert` \| `archive` (binaire « pas fini » / « fini ») |

#### Jalon
| Champ | Type | Notes |
|---|---|---|
| `id` | int | PK |
| `nom` | str | obligatoire |
| `date` | date | obligatoire |
| `atteint` | bool | défaut false |
| `epics` | list[Epic] | relation N-N via `milestone_epic`, au moins 1 |

Un jalon peut être rattaché à plusieurs epics simultanément (révision 0006, suppression du concept de « jalon transverse projet »).

#### Dépendance
| Champ | Type | Notes |
|---|---|---|
| `id` | int | PK |
| `tâche_amont_id` | int | FK → Tâche |
| `tâche_aval_id` | int | FK → Tâche |
| `type` | enum | `FS` (finish-to-start, défaut) \| `SS` \| `FF` |

#### User
| Champ | Type | Notes |
|---|---|---|
| `id` | int | PK |
| `nom` | str | obligatoire |
| `email` | str | unique, obligatoire |
| `password_hash` | str | bcrypt |
| `rôle` | enum | `admin` \| `membre` |
| `actif` | bool | défaut true |

#### Mesure
| Champ | Type | Notes |
|---|---|---|
| `id` | int | PK |
| `epic_trigramme` | str(3) | FK → Epic |
| `date` | date | obligatoire |
| `valeur` | float | obligatoire |
| `unité` | str | obligatoire (cohérente par Epic) |
| `commentaire` | text | optionnel |

### Audit (sur toutes les entités mutables)
`created_at`, `updated_at`, `updated_by` (FK User).

## 3. Invariants métier

Chaque invariant a un **identifiant stable** (`INV-X`). En phase 2, chaque
invariant donnera lieu à au moins un test automatique référencé par cet ID.

Un invariant est : *une propriété qui doit rester vraie après toute mutation
de la base*. Une tentative de mutation qui violerait un invariant doit être
**refusée** (HTTP 400/409) — pas silencieusement corrigée.

### Identité

| ID | Énoncé |
|---|---|
| INV-1 | `Epic.trigramme` est unique et respecte `^[A-Z0-9]{3}$`. |
| INV-2 | `Epic.nom` est non vide (après trim). |
| INV-3 | `Epic.statut = actif` ⇒ `critère_réussite` non vide. |
| INV-AUTH-1 | `User.email` est unique (insensible à la casse). |
| INV-AUTH-2 | `count(User where actif=true) ≤ 10`. |
| INV-AUTH-3 | `count(User where actif=true AND rôle=admin) ≥ 1`. |

### Hiérarchie

| ID | Énoncé |
|---|---|
| INV-4 | Toute `Tâche` référence un `Projet` existant. |
| INV-5 | Tout `Projet` référence un `Epic` existant. |
| INV-6 | Tout `Jalon` est rattaché à au moins un `Epic` (relation N-N). Le concept de « jalon transverse projet » a été retiré en migration 0006. |

### Dates (cascade)

Unité : **jour calendaire**. Toutes les comparaisons sont inclusives.

| ID | Énoncé |
|---|---|
| INV-7 | `Tâche.date_début ≤ Tâche.date_fin`. |
| INV-8 | `Projet.date_début ≤ Projet.date_fin`. |
| INV-9 | ~~Supprimé.~~ Une tâche peut désormais sortir de la fenêtre de son projet. Le planning Gantt affiche une hachure rouge sur la barre concernée pour signaler la situation, mais l'API ne refuse plus la mutation. |
| INV-10 | Si `Epic.date_fin_prévue` est définie : pour tout `Projet` de cet Epic, `Projet.date_fin ≤ Epic.date_fin_prévue`. |
| INV-11 | Si `Epic.jalon_fin_max` est défini : pour tout `Jalon` rattaché à cet Epic, `Jalon.date ≤ Epic.jalon_fin_max`. |
| INV-12 | Si `Epic.date_fin_prévue` ET `Epic.jalon_fin_max` sont définies : `date_fin_prévue ≤ jalon_fin_max`. |
| INV-13 | ~~Supprimé.~~ Les contraintes de dates FS/SS/FF entre tâches dépendantes ont été retirées — une dépendance peut être créée librement, l'ordre chronologique des dates n'est plus imposé. INV-14 (DAG) et INV-15 (pas d'auto-dépendance) restent en vigueur. |

### Graphe des dépendances

| ID | Énoncé |
|---|---|
| INV-14 | Le graphe global des dépendances entre tâches est un DAG (pas de cycle). Les dépendances **peuvent traverser projets et epics**. |
| INV-15 | Une `Dépendance` a `tâche_amont_id ≠ tâche_aval_id` (pas d'auto-dépendance). |

### Avancement & statut

| ID | Énoncé |
|---|---|
| INV-16 | ~~Supprimé.~~ Le champ `avancement_%` a été retiré (migration 0007) — la complétion d'une tâche est portée par son seul `statut`. |
| INV-17 | ~~Supprimé.~~ Voir INV-16. |
| INV-18 | `Projet.statut = réalisé` ⇒ toutes ses tâches sont `archive`. |
| INV-19 | `Epic.statut = réalisé` ⇒ tous ses projets sont `réalisé` ou `abandonné` ET tous ses jalons sont `atteint`. |

### Mesures

| ID | Énoncé |
|---|---|
| INV-20 | Toutes les `Mesure` d'un même Epic partagent la même `unité`. |

### Audit

| ID | Énoncé |
|---|---|
| INV-21 | Toute mutation (create/update/delete) met à jour `updated_at` et `updated_by` sur l'entité concernée. |

## 4. Interface utilisateur

### Écrans

1. **Login** — email + mot de passe.
2. **Vue Gantt** (page d'accueil) :
   - Une ligne par Epic, repliable pour afficher Projets puis Tâches.
   - Barres = Projets/Tâches, losanges = Jalons, flèches = Dépendances.
   - Filtres : catégorie, responsable, statut, plage de dates.
   - Zoom : jour / semaine / mois / trimestre.
   - Bouton "aujourd'hui" (curseur vertical sur la date du jour).
3. **Liste / CRUD Epics** — table triable, formulaire d'édition.
4. **Liste / CRUD Projets**.
5. **Liste / CRUD Tâches**.
6. **Liste / CRUD Jalons**.
7. **Liste / CRUD Dépendances**.
8. **Page Epic** (détail) : infos + courbe de la `Mesure` dans le temps + liste des projets et jalons.
9. **Liste / CRUD Mesures** (depuis la page Epic).
10. **Gestion utilisateurs** (admin uniquement) : créer / désactiver / changer rôle.
11. **Paramètres / Backup** : déclencher un dump, voir l'historique des backups.

### Règles d'interface

- Les violations d'invariants sont signalées **avant** soumission quand
  c'est possible (validation côté formulaire) ET refusées côté API (source
  de vérité).
- Les actions destructives (suppression d'Epic, désactivation user)
  demandent confirmation.
- Le drag-and-drop des barres dans le Gantt déclenche une mutation
  (date_début / date_fin) qui doit passer toutes les validations
  d'invariants — sinon rollback visuel.

## 5. Stack technique

| Couche | Choix |
|---|---|
| Backend API | Python 3.12 + FastAPI |
| ORM | SQLAlchemy 2.x |
| Migrations | Alembic |
| Auth | JWT, bcrypt (passlib) |
| Base | PostgreSQL 16 |
| Frontend | React + Vite + TypeScript |
| Lib Gantt | `gantt-task-react` (à confirmer à la v0) |
| Conteneurisation | Docker Compose |
| CI | GitHub Actions |
| Tests phase 2 | pytest + Hypothesis (invariants) + Playwright (e2e) |

### Services Docker Compose

- `db` — Postgres, volume persistant.
- `api` — FastAPI.
- `web` — front compilé servi par nginx.
- `proxy` — nginx en façade.
- `backup` — conteneur cron qui exécute `pg_dump` quotidien dans un
  volume séparé, rotation 30 jours.

## 6. Sécurité

- Authentification obligatoire sur tous les endpoints sauf `/login`.
- Mots de passe stockés en bcrypt.
- JWT court (1h) + refresh.
- Rôles : `admin` (toutes opérations + gestion users), `membre` (CRUD
  métier sans gestion users).
- HTTPS attendu côté proxy en production (serveur pisci).

## 7. Persistance / Backup

- Volume Docker dédié pour les données Postgres.
- `pg_dump` quotidien automatique (conteneur `backup`).
- Rotation : 30 jours.
- Procédure de restore documentée (à écrire à la v0).

## 8. CI

À chaque push :
1. Lint Python (`ruff`) + format check (`black`).
2. Lint front (`eslint`) + type-check (`tsc`).
3. Tests pytest (incluant phase 2 quand prête).
4. Build images Docker.

## 9. Hors périmètre v0

- Import CSV (la *seed* initiale suffit).
- Notifications (mail, Slack).
- Export PDF du Gantt.
- Multi-tenant.
- Mobile dédié (responsive web suffit).
