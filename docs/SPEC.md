# Spécification — Gestionnaire de projet (Phase 1)

Version : 0.2 — révisée le 2026-07-17 (0.1 figée le 2026-05-19)
Statut : définition du besoin — **réconciliée avec le code livré**

> **Nature de la révision 0.2.** Ce n'est **pas** une redéfinition du besoin : aucune règle
> métier ne change. La 0.1 avait divergé du code sur trois points, et ce document est remis en
> conformité avec ce qui tourne réellement :
>
> 1. Les **Équipes** (§2, §3, §4) existaient dans le code depuis la migration `0005` — 2 tables,
>    12 endpoints, 3 écrans — sans **aucune** mention ici. C'était le plus gros écart spec↔code.
> 2. Les invariants retirés (INV-9, INV-13, INV-16, INV-17) sont désormais retirés **du code
>    aussi**, pas seulement barrés ici.
> 3. Le statut de livraison de chaque écran (§4) est explicite : la 0.1 ne distinguait pas ce qui
>    est spécifié de ce qui est livré.
>
> **Distinction tenue tout au long de cette révision** : là où le code reflète un choix
> **délibéré**, c'est la spec qui est corrigée ; là où le code s'écarte de l'intention, c'est un
> **défaut** — la spec reste la référence et l'écart est signalé comme tel (voir INV-6).
> Les identifiants `INV-X` déjà attribués sont **stables** et n'ont pas été réutilisés.
>
> État de l'existant et dette associée : [`INVENTAIRE.md`](../INVENTAIRE.md).

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
Projet >── Jalon ──< Projet  (relation N-N : un jalon peut être rattaché à plusieurs projets, migration 0008)
Tâche >── Dépendance ──< Tâche   (DAG global, cross-projet et cross-epic autorisé)
Tâche >── TâcheÉquipe ──< Équipe (relation N-N portant les heures allouées, migration 0005)
Epic ──< Mesure                  (suivi du critère de réussite)
User                              (responsable de Projet ou Tâche)
```

L'**Équipe** est la seule dimension de charge du modèle. Elle ne s'attache qu'à la **Tâche** :
il n'existe pas de lien Équipe→Projet ni Équipe→Epic. La charge d'un projet est donc toujours
une somme dérivée de ses tâches, jamais une donnée saisie.

Une **Équipe** n'est pas un **User** : un User est un compte qui se connecte et peut être
*responsable* d'un Projet ou d'une Tâche ; une Équipe est un pot de capacité horaire, sans compte
ni authentification. Les deux notions ne sont pas reliées dans le modèle.

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
| `projects` | list[Project] | relation N-N via `milestone_project`, au moins 1 |

Un jalon est désormais rattaché à un ou plusieurs **projets** (révision 0008). La précision est meilleure que l'ancien rattachement par epic. La portée sur le planning (où la ligne verticale s'arrête) est l'union des projets liés.

#### Dépendance
| Champ | Type | Notes |
|---|---|---|
| `id` | int | PK |
| `tâche_amont_id` | int | FK → Tâche |
| `tâche_aval_id` | int | FK → Tâche |
| `type` | enum | `FS` (finish-to-start, défaut) \| `SS` \| `FF` |

#### Équipe
| Champ | Type | Notes |
|---|---|---|
| `id` | int | PK |
| `nom` | str(200) | obligatoire, unique (insensible à la casse) |
| `temps_dispo_hebdo` | float | obligatoire, ≥ 0, défaut 0 — capacité en heures par semaine |

#### TâcheÉquipe (allocation)
| Champ | Type | Notes |
|---|---|---|
| `id` | int | PK |
| `tâche_id` | int | FK → Tâche |
| `équipe_id` | int | FK → Équipe |
| `heures_allouées` | float | obligatoire, > 0 |

Table d'association **N-N porteuse d'une donnée** (`heures_allouées`) : c'est pourquoi elle a une
PK propre plutôt que d'être une simple table de jointure. Au plus une allocation par couple
(Tâche, Équipe) — pour allouer davantage d'heures, on modifie l'allocation existante.

Les heures sont allouées **sur toute la durée de la tâche**, sans notion de calendrier interne.
La répartition hebdomadaire affichée par l'écran *Charge équipes* est **dérivée** : les heures
sont étalées linéairement, par jour, sur la fenêtre `[date_début, date_fin]` de la tâche.

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
`created_at`, `updated_at`, `updated_by` (FK User). S'applique aussi à `Équipe` et `TâcheÉquipe`.

> **Écart connu.** `updated_by` n'est **pas** une FK dans le code : c'est un entier nu, sans
> contrainte référentielle, sur les 8 tables concernées — supprimer un utilisateur laisse des
> identifiants pendants. Par ailleurs `User` ne porte pas la colonne, alors que son schéma de
> lecture l'expose (toujours `null`). Défaut à corriger ; l'énoncé ci-dessus reste la référence.

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
| INV-6 | Tout `Jalon` est rattaché à au moins un `Projet` (relation N-N depuis la migration 0008 — passage epic → projet pour gagner en précision). |

> **INV-6 — défaut connu, l'énoncé ci-dessus reste la référence.** L'invariant est vérifié à la
> création et à la mise à jour d'un jalon, mais **contournable par un chemin détourné** :
> supprimer un projet cascade ses lignes `milestone_project` et peut laisser un jalon à zéro
> projet, sans aucune revalidation ni contrainte en base. Le jalon devient alors **inéditable**
> (toute mise à jour est refusée par INV-6 tant qu'aucun projet n'est fourni). La migration `0008`
> documente déjà le même cas pour les jalons d'un epic sans projet. C'est un **défaut à corriger**,
> pas un assouplissement à entériner : la spec n'est pas alignée sur ce comportement.

### Dates (cascade)

Unité : **jour calendaire**. Toutes les comparaisons sont inclusives.

| ID | Énoncé |
|---|---|
| INV-7 | `Tâche.date_début ≤ Tâche.date_fin`. |
| INV-8 | `Projet.date_début ≤ Projet.date_fin`. |
| INV-9 | ~~Supprimé.~~ Une tâche peut désormais sortir de la fenêtre de son projet. Le planning Gantt affiche une hachure rouge sur la barre concernée pour signaler la situation, mais l'API ne refuse plus la mutation. *Retiré du code le 2026-07-17 : `check_task_dates_within_project` était resté défini et exporté, sans aucun appelant.* |
| INV-10 | Si `Epic.date_fin_prévue` est définie : pour tout `Projet` de cet Epic, `Projet.date_fin ≤ Epic.date_fin_prévue`. |
| INV-11 | Si `Epic.jalon_fin_max` est défini : pour tout `Jalon` rattaché à cet Epic, `Jalon.date ≤ Epic.jalon_fin_max`. |
| INV-12 | Si `Epic.date_fin_prévue` ET `Epic.jalon_fin_max` sont définies : `date_fin_prévue ≤ jalon_fin_max`. |
| INV-13 | ~~Supprimé.~~ Les contraintes de dates FS/SS/FF entre tâches dépendantes ont été retirées — une dépendance peut être créée librement, l'ordre chronologique des dates n'est plus imposé. INV-14 (DAG) et INV-15 (pas d'auto-dépendance) restent en vigueur. *Retiré du code le 2026-07-17 : `check_dependency_dates` était un `return  # no-op` encore appelé depuis 2 routes, dont une boucle qui interrogeait la base à chaque mutation de tâche pour l'alimenter.* |

### Graphe des dépendances

| ID | Énoncé |
|---|---|
| INV-14 | Le graphe global des dépendances entre tâches est un DAG (pas de cycle). Les dépendances **peuvent traverser projets et epics**. |
| INV-15 | Une `Dépendance` a `tâche_amont_id ≠ tâche_aval_id` (pas d'auto-dépendance). |

### Avancement & statut

| ID | Énoncé |
|---|---|
| INV-16 | ~~Supprimé.~~ Le champ `avancement_%` a été retiré (migration 0007) — la complétion d'une tâche est portée par son seul `statut`. *La fonction `check_task_advancement_status` a été supprimée avec, mais `tests/test_smoke.py` a continué de l'importer jusqu'au 2026-07-17 — une des deux pannes qui tenaient la CI en échec.* |
| INV-17 | ~~Supprimé.~~ Voir INV-16. |
| INV-18 | `Projet.statut = réalisé` ⇒ toutes ses tâches sont `archive`. |
| INV-19 | `Epic.statut = réalisé` ⇒ tous ses projets sont `réalisé` ou `abandonné` ET tous ses jalons sont `atteint`. |

### Équipes & allocations

Ajoutés en 0.2 : ces règles étaient **déjà appliquées par le code** (migration `0005`) mais
n'avaient jamais été spécifiées, donc jamais identifiées. Elles suivent la convention nommée
d'`INV-AUTH-*` plutôt que la numérotation `INV-1..21`, qui est close.

| ID | Énoncé | Appliqué ? |
|---|---|---|
| INV-EQ-1a | `Équipe.nom` est non vide **après trim**. | ❌ **non** — voir ci-dessous |
| INV-EQ-1b | `Équipe.nom` est unique (insensible à la casse). | ✅ |
| INV-EQ-2 | `Équipe.temps_dispo_hebdo ≥ 0`. | ✅ |
| INV-EQ-3 | `TâcheÉquipe.heures_allouées > 0`. | ✅ |
| INV-EQ-4 | Au plus une `TâcheÉquipe` par couple (`tâche_id`, `équipe_id`). | ✅ |
| INV-EQ-5 | Toute `TâcheÉquipe` référence une `Tâche` et une `Équipe` existantes. | ✅ |

**INV-EQ-1a — défaut, pas choix.** Le nom d'équipe est validé par `Field(min_length=1)`, qui compte
les caractères **sans trim** : une équipe nommée `"   "` est acceptée (vérifié — `HTTP 201`).
`Epic.nom` est, lui, bien vérifié après trim (INV-2, via `check_epic_basics`). Rien ne justifie
l'asymétrie : c'est un oubli. L'énoncé ci-dessus reste la référence, l'implémentation doit suivre.
INV-EQ-1 est scindé en `1a`/`1b` précisément parce que ses deux moitiés n'ont pas le même statut —
les tester ensemble masquerait le trou.

**Écart connu à corriger (défaut, pas choix).** Les règles marquées ✅ sont bien appliquées, mais
`routes/equipes.py` et `routes/tache_equipe.py` sont les **seuls routers à n'utiliser ni
`app.invariants` ni `http_from_invariant`** : ils lèvent des `HTTPException(409, "…")` portant une
chaîne libre au lieu du `{"code", "message"}` que produit tout le reste. **Les violations Équipe ne
remontent donc aucun code `INV-EQ-*` au client.** Conséquence directe pour la phase 2 : la règle du
`README.md` — « chaque ID `INV-X` donne lieu à au moins un test » — est **inapplicable telle quelle
aux Équipes**. Câbler ces cinq codes est un prérequis de la phase 2, pas un raffinement.

### Non-invariants délibérés

Consignés ici pour qu'ils ne soient pas « recorrigés » plus tard par erreur, et pour que leur
absence de test ne passe pas pour un trou de couverture.

| Sujet | Parti pris |
|---|---|
| Surcharge d'une équipe | La somme des heures allouées à une équipe sur une semaine **peut** dépasser `temps_dispo_hebdo`. L'écran *Charge équipes* la signale en rouge ; l'API ne refuse pas. |
| Tâche hors fenêtre de son projet | Voir INV-9 : hachure rouge sur le Gantt, mutation acceptée. |
| Dates des tâches dépendantes | Voir INV-13 : aucune contrainte chronologique, seul le graphe est contraint (INV-14, INV-15). |

Ces trois cas relèvent du même principe, qui mérite d'être nommé : **le planning signale, l'API
ne bloque que l'incohérence structurelle.** Une surcharge ou un chevauchement sont des faits de
gestion que l'utilisateur doit voir et arbitrer ; un cycle de dépendances ou un jalon orphelin
sont des états que la base ne doit pas pouvoir atteindre.

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

Statut de livraison au 2026-07-17 — ✅ livré · 🟡 partiel · ❌ non livré.
Un écran non livré reste **au périmètre** : c'est du reste-à-faire, pas un renoncement. Le
périmètre explicitement abandonné est au §9.

| # | Écran | Statut |
|---|---|---|
| 1 | **Login** — email + mot de passe. | ✅ |
| 2 | **Vue Gantt** (page d'accueil) — voir détail ci-dessous. | ✅ |
| 3 | **Liste / CRUD Epics** — table triable, formulaire d'édition. | ✅ |
| 4 | **Liste / CRUD Projets**. | ✅ |
| 5 | **Liste / CRUD Tâches**. | ✅ |
| 6 | **Liste / CRUD Jalons**. | ✅ |
| 7 | **Liste / CRUD Dépendances**. | 🟡 création et suppression seulement : une dépendance n'est pas modifiable (ni API, ni UI). Seul son `type` serait mutable ; l'usage est de supprimer puis recréer. |
| 8 | **Page Epic** (détail) : infos + courbe de la `Mesure` dans le temps + liste des projets et jalons. | 🟡 infos, projets et jalons livrés. **La courbe des mesures n'existe pas.** |
| 9 | **Liste / CRUD Mesures** (depuis la page Epic). | ❌ L'API est complète et le client HTTP expose `create`/`update`/`remove` — **aucun n'est appelé**. Les mesures sont en lecture seule dans l'UI. |
| 10 | **Gestion utilisateurs** (admin uniquement) : créer / désactiver / changer rôle. | ✅ |
| 11 | **Paramètres / Backup** : déclencher un dump, voir l'historique des backups. | ❌ Aucune page, aucune route, aucun endpoint. Le backup ne se pilote qu'en ligne de commande ([`RESTORE.md`](RESTORE.md)). |

**Vue Gantt** (écran 2) — la 0.1 prévoyait :
- Une ligne par Epic, repliable pour afficher Projets puis Tâches. ✅
- Barres = Projets/Tâches, losanges = Jalons, flèches = Dépendances. ✅ — mais **seules les
  dépendances `FS` sont dessinées** : une dépendance `SS` ou `FF` est créable et reste invisible
  sur le planning.
- Filtres : catégorie, responsable, statut, plage de dates. 🟡 — le filtre livré est **par équipe**,
  arrivé avec les Équipes ; les quatre filtres prévus ne le sont pas.
- Zoom : jour / semaine / mois / trimestre. 🟡 — jour / semaine / mois ; **pas de trimestre**.
- Bouton "aujourd'hui" (curseur vertical sur la date du jour). ✅

Livré **en plus** de la 0.1, à la faveur des itérations : groupement par epic repliable,
annulation (Ctrl+Z) des déplacements et des liens, sélection multiple et décalage groupé,
propagation FS en cascade, création et suppression de dépendance au glisser-déposer.

### Écrans ajoutés en 0.2

Livrés sans avoir été spécifiés — la 0.1 ne les mentionne pas.

| # | Écran | Statut |
|---|---|---|
| 12 | **Liste / CRUD Équipes** — nom, temps disponible hebdomadaire. | ✅ |
| 13 | **Charge équipes** — heatmap équipes × semaines (fenêtre 4 à 52 semaines). Chaque cellule somme les heures allouées, étalées linéairement sur la durée de chaque tâche ; une cellule dépassant `temps_dispo_hebdo` passe au rouge. Le clic détaille les tâches contributrices. | ✅ |

L'allocation d'heures par équipe se fait depuis l'écran d'édition d'une **Tâche** (section
« Équipes impliquées »), pas depuis l'écran Équipes.

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
| Lib Gantt | `gantt-task-react` ^0.3.9 — **confirmé à la v0** |
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

- Authentification obligatoire sur tous les endpoints sauf `/login` — et `/api/health`,
  volontairement ouvert (sonde, ne divulgue rien).
- Mots de passe stockés en bcrypt.
- JWT court (1h) + refresh. → **le refresh n'est pas implémenté** : il n'existe qu'un
  `POST /api/auth/login`. À l'expiration, le client repasse par l'écran de connexion. Reste au
  périmètre.
- Rôles : `admin` (toutes opérations + gestion users), `membre` (CRUD
  métier sans gestion users).
- HTTPS attendu côté proxy en production (serveur pisci). *Non configuré à ce jour : le proxy ne
  fait pas de TLS. Sans objet tant que le déploiement est local.*

**Précision 0.2 sur le rôle `membre`** — « CRUD métier sans gestion users » se lit bien au sens
large : un membre actif peut créer, modifier **et supprimer** n'importe quel epic, projet, tâche,
jalon, dépendance, mesure et équipe. Il n'y a ni contrôle d'appartenance, ni restriction liée à
`responsable_id`. Le code est **conforme** à cet énoncé — ce point est consigné parce qu'il
surprend à la lecture du code (3 endpoints gardés par `require_admin` sur 40), et qu'il vaut mieux
l'avoir arbitré sciemment. S'il fallait un jour restreindre les suppressions aux admins, ce serait
un **changement de besoin**, à décider ici avant d'être codé.

Seul écart réel constaté : `GET /api/users` n'est pas réservé aux admins — tout membre peut
énumérer les comptes (nom, email, rôle, actif ; les hash ne sont jamais exposés). À arbitrer :
lister n'est sans doute pas « gérer », mais l'intention n'est pas tranchée par la 0.1.

### Bascule de développement `AUTH_DISABLED`

Absent de la 0.1, présent dans le code et dans `.env.example`. Quand `AUTH_DISABLED=true`, l'API
**ignore tout token** et exécute chaque requête en tant que premier admin actif — authentification
et RBAC entièrement court-circuités. Prévu pour le pilotage par script (`scripts/import_data.py`
en dépend). Ne doit **jamais** être activé en production ; vaut par défaut `false`.

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

**État réel au 2026-07-17.** La CI n'avait **jamais été verte** : le job `api` enchaîne `ruff` puis
`pytest` et échouait dès le lint — 79 erreurs dès le commit initial — donc `pytest` n'était jamais
atteint, et le job `docker` (`needs: [api, web]`) jamais exécuté. Réparé le 2026-07-17 : les trois
jobs passent.

Écarts subsistants avec les 4 points ci-dessus :

| Prévu | Réel |
|---|---|
| `ruff` | ✅ vert |
| format check `black` | ❌ `black` est déclaré en dev-dep et **jamais exécuté**. À trancher : `ruff format` fait double emploi et le remplacerait avantageusement. |
| lint front `eslint` | ❌ le job s'appelle « Web — lint + build » mais **n'a pas d'étape lint**. `npm run lint` est de toute façon inexécutable : ESLint 9 est installé **sans fichier de configuration**. |
| type-check `tsc` | ✅ via `npm run build` (`tsc -b && vite build`). |
| tests `pytest` | ✅ vert — mais 1 invariant couvert sur 20 (phase 2). |
| build images Docker | ✅ les 3 images, depuis le 2026-07-17. |
| « à chaque push » | ❌ `push:` est limité à `main` ; ailleurs, la CI ne tourne que si une PR est ouverte. |

Non prévu par la 0.1 mais souhaitable, au vu de l'écart modèles↔migrations constaté :
`alembic check` en CI, pour qu'une divergence entre les modèles et les migrations casse le build
plutôt que d'être découverte au prochain `--autogenerate`.

## 9. Hors périmètre v0

- Import CSV (la *seed* initiale suffit).
- Notifications (mail, Slack).
- Export PDF du Gantt.
- Multi-tenant.
- Mobile dédié (responsive web suffit).
