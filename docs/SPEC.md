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

#### Point de contrôle (todo)
*Ajouté le 2026-08-05, sur retour d'usage.* Une liste à cocher **à l'intérieur**
d'une tâche. Ce n'est **pas** une sous-tâche : la hiérarchie s'arrête à
Epic → Projet → Tâche, et tout ce qui porte des dates, un responsable ou des
dépendances est une tâche. Un todo n'a rien de cela et ne pèse sur aucun
invariant, aucun planning, aucune charge.

| Champ | Type | Notes |
|---|---|---|
| `id` | int | PK |
| `tache_id` | int | FK → Tâche (CASCADE) |
| `libellé` | str(200) | obligatoire, non vide |
| `fait` | bool | défaut `false` |

Pas de rang : la liste suit l'ordre de création. La **suppression est ouverte aux
membres** — seule de l'API dans ce cas, cf. §6.

#### Entrée de journal (activité)
*Ajoutée le 2026-08-05, sur retour d'usage.* Un compte rendu de ce qui a été fait
sur une tâche — « j'ai vissé les boulons » — horodaté et signé.

| Champ | Type | Notes |
|---|---|---|
| `id` | int | PK |
| `tache_id` | int | FK → Tâche (CASCADE) |
| `texte` | text | obligatoire, ≤ 2000 |
| `auteur_id` | int | pris du JETON, jamais du corps de la requête |
| `auteur_nom` | str(120) | **copie** du nom au moment de l'écriture |
| `created_at` | datetime | l'horodatage |

**IMMUABLE** : aucune route ne modifie une entrée — ni `PUT`, ni `PATCH`, et le
schéma de mise à jour n'existe pas. C'est ce qui en fait une trace plutôt qu'une
note. La suppression existe (une saisie sur la mauvaise tâche arrive) mais elle
est **réservée aux administrateurs** : ouverte à tous, elle rendrait l'immuabilité
illusoire — il suffirait de supprimer puis republier.

`auteur_nom` est dupliqué à dessein. Un journal dit qui a écrit *à cette date-là* :
renommer un compte ensuite ne doit pas réécrire l'histoire, ni le supprimer laisser
des entrées anonymes (`auteur_id` n'est FK vers rien, comme `updated_by_id`).

Ordre d'affichage : **plus récent d'abord**. On ouvre une tâche pour savoir où
elle en est, pas pour relire son histoire depuis le début.

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
| INV-AUTH-2 | `count(User where actif=true) ≤ 10`. Plafond **configurable** (`MAX_ACTIVE_USERS`) depuis le 2026-07-29 : il était figé par le fichier compose, qui ne transmettait pas la variable. Le défaut reste 10. |
| INV-AUTH-3 | `count(User where actif=true AND rôle=admin) ≥ 1`. |

### Hiérarchie

| ID | Énoncé |
|---|---|
| INV-4 | Toute `Tâche` référence un `Projet` existant. |
| INV-5 | Tout `Projet` référence un `Epic` existant. |
| INV-6 | Tout `Jalon` est rattaché à au moins un `Projet` (relation N-N depuis la migration 0008 — passage epic → projet pour gagner en précision). |

> **INV-6 — désormais tenu sur toutes les mutations (corrigé le 2026-07-22).** L'invariant était
> vérifié à la création et à la mise à jour d'un jalon, mais **contournable par un chemin détourné** :
> supprimer un projet (ou un epic, qui cascade sur ses projets) retirait des lignes
> `milestone_project` et pouvait laisser un jalon à zéro projet — jalon alors **inéditable**. La
> suppression d'un projet ou d'un epic est maintenant **refusée (409, code `INV-6`)** si elle
> orphelinerait un jalon, avec un message invitant à rattacher le jalon ailleurs ou à le supprimer
> d'abord. Conforme au principe ci-dessous (« l'API bloque l'incohérence structurelle ») : un jalon
> orphelin est un état que la base ne doit pas pouvoir atteindre.

### Dates (cascade)

Unité : **jour calendaire**. Toutes les comparaisons sont inclusives.

| ID | Énoncé |
|---|---|
| INV-7 | `Tâche.date_début ≤ Tâche.date_fin`. |
| INV-8 | `Projet.date_début ≤ Projet.date_fin`. |
| INV-9 | ~~Supprimé.~~ Une tâche peut désormais sortir de la fenêtre de son projet, et l'API ne refuse plus la mutation. *Retiré du code le 2026-07-17 : `check_task_dates_within_project` était resté défini et exporté, sans aucun appelant.* Le signal visuel, perdu lors de la bascule SVAR (C9), a été **rétabli le 2026-08-04** : les portions de la barre situées hors de la fenêtre du projet sont hachurées en rouge, avec un trait plein à la borne franchie, et l'infobulle dit de quel côté et de combien. Ce sont les portions FAUTIVES qui sont hachurées, pas la barre entière — hachurer tout dirait « quelque chose ne va pas » sans dire quoi. |
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

| ID | Énoncé | Fonction | Refus |
|---|---|---|---|
| INV-EQ-1a | `Équipe.nom` est non vide **après trim**. | `check_equipe_nom` | 409 `INV-EQ-1a` |
| INV-EQ-1b | `Équipe.nom` est unique (insensible à la casse). | `check_equipe_nom_unique` | 409 `INV-EQ-1b` |
| INV-EQ-2 | `Équipe.temps_dispo_hebdo ≥ 0`. | `check_equipe_temps_dispo` | 422 (schéma) |
| INV-EQ-3 | `TâcheÉquipe.heures_allouées > 0`. | `check_allocation_heures` | 422 (schéma) |
| INV-EQ-4 | Au plus une `TâcheÉquipe` par couple (`tâche_id`, `équipe_id`). | `check_allocation_unique` | 409 `INV-EQ-4` |
| INV-EQ-5 | Toute `TâcheÉquipe` référence une `Tâche` et une `Équipe` existantes. | `check_allocation_refs` | 409 `INV-EQ-5` |

INV-EQ-1 est scindé en `1a`/`1b` parce que ses deux moitiés n'avaient pas le même statut à la
rédaction de la 0.2 : `1b` était appliqué, `1a` ne l'était pas. Les garder distincts évite qu'un
test unique ne masque à nouveau la moitié manquante.

**INV-EQ-2 et INV-EQ-3 refusent en 422, pas en 409.** Ce n'est pas une anomalie mais la convention
déjà en vigueur pour **INV-1** : la contrainte est portée par le schéma Pydantic
(`Field(ge=0)` / `Field(gt=0)` / `pattern=…`), qui rejette avant que la route ne s'exécute et
documente la règle dans l'OpenAPI. La fonction `check_*` reste la **définition testable** de
l'invariant — c'est elle que la phase 2 éprouve unitairement — même si, via l'API, c'est le schéma
qui refuse en premier. Les contraintes `CHECK` en base forment la dernière ligne.

*Historique (résolu le 2026-07-17, chantier C10).* `routes/equipes.py` et `routes/tache_equipe.py`
étaient les seuls routers à n'utiliser ni `app.invariants` ni `http_from_invariant` : ils levaient
des `HTTPException(409, "chaîne libre")`, sans identifiant. Les violations Équipe ne remontaient
donc aucun code, ce qui rendait la règle du `README.md` — « chaque `INV-X` donne lieu à au moins un
test : mutation refusée **avec le bon code** » — inapplicable aux Équipes. Les six codes sont
désormais câblés. Deux changements de comportement à noter :

- `INV-EQ-1a` **refuse désormais** un nom composé uniquement d'espaces (auparavant `HTTP 201`), et
  le nom est *trimmé* à l'écriture ;
- `INV-EQ-5` renvoie **409 + code** au lieu de **404**, par alignement sur INV-4 (`Projet inconnu`),
  qui traite déjà une référence manquante comme une violation d'invariant et non comme une
  ressource absente.

### Non-invariants délibérés

Consignés ici pour qu'ils ne soient pas « recorrigés » plus tard par erreur, et pour que leur
absence de test ne passe pas pour un trou de couverture.

| Sujet | Parti pris |
|---|---|
| Surcharge d'une équipe | La somme des heures allouées à une équipe sur une semaine **peut** dépasser `temps_dispo_hebdo`. L'écran *Charge équipes* la signale en rouge ; l'API ne refuse pas. |
| Tâche hors fenêtre de son projet | Voir INV-9 : mutation acceptée, portions hors fenêtre hachurées en rouge sur le Gantt (rétabli le 2026-08-04). |
| Dates des tâches dépendantes | Voir INV-13 : aucune contrainte chronologique, seul le graphe est contraint (INV-14, INV-15). |
| Projet finissant après son jalon | Un jalon fixe une **date limite** aux projets qui lui sont rattachés, mais le dépassement **n'est pas refusé** : le planning hachure la portion en retard (en rouge, avec un liseré à la date du jalon) et laisse l'arbitrage au responsable. Tranché par le PO le 2026-08-04, après constat de 4 dépassements sur 13 rattachements dans les données réelles — dont un de 579 jours : en faire un invariant aurait rendu la base existante inmodifiable. |

Ces quatre cas relèvent du même principe, qui mérite d'être nommé : **le planning signale, l'API
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
| 8 | **Page Epic** (détail) : infos + courbe de la `Mesure` dans le temps + liste des projets et jalons. | ✅ livré (courbe SVG maison, sans librairie de graphes). |
| 9 | **Liste / CRUD Mesures** (depuis la page Epic). | ✅ livré : création, édition inline, suppression. INV-20 porté par l'UI (unité verrouillée dès qu'une mesure existe). |
| 10 | **Gestion utilisateurs** (admin uniquement) : créer / désactiver / changer rôle. | ✅ |
| 11 | **Paramètres / Backup** : déclencher un dump, voir l'historique des backups. | ✅ livré (`/parametres`, admin) — **sans téléchargement**, choix délibéré : servir un dump serait un chemin d'exfiltration complet de la base. Le restore reste en ligne de commande ([`RESTORE.md`](RESTORE.md)). |

**Vue Gantt** (écran 2) — la 0.1 prévoyait :
- Une ligne par Epic, repliable pour afficher Projets puis Tâches. ✅
- Barres = Projets/Tâches, losanges = Jalons, flèches = Dépendances. ✅ — ~~seules les
  dépendances `FS` sont dessinées~~ **corrigé le 2026-08-04 : les TROIS types sont dessinés**
  depuis la bascule SVAR (#54). La phrase décrivait l'ancien moteur, qui ne rendait que les `FS` ;
  `buildSvarLinks` mappe désormais `FS`→`e2s`, `SS`→`s2s`, `FF`→`e2e`. Vérifié en affichant une
  `SS`.
  <br>Reste vrai en revanche, et c'est ce qui compte : **seules les `FS` déplacent quelque chose**.
  La cascade du planning ne suit qu'elles (`fsEdgesFromDeps`) — une `SS` ou une `FF` est dessinée
  et inerte. Changer le type d'une dépendance change donc son effet, ce n'est pas un libellé.
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
| Backend API | Python 3.14 + FastAPI |
| ORM | SQLAlchemy 2.x |
| Migrations | Alembic |
| Auth | **Keycloak (OIDC)** — code + PKCE S256 côté front, validation RS256/JWKS côté API. bcrypt en direct pour les comptes hérités (`passlib` retiré, non maintenu depuis 2020). Cf. §6 |
| Base | PostgreSQL 16 |
| Frontend | React 19 + Vite 8 + TypeScript 6 |
| Lib Gantt | `@svar-ui/react-gantt` ^2.7 — **remplace `gantt-task-react`**, retiré à la bascule C9 (2026-07-28) |
| Conteneurisation | Docker Compose |
| CI | GitHub Actions |
| Tests | pytest + Hypothesis (invariants ; suite rejouée sur **PostgreSQL** en CI) · Vitest (front) · Playwright (e2e) |

### Services Docker Compose

- `db` — Postgres, volume persistant.
- `api` — FastAPI.
- `web` — front compilé servi par nginx.
- `proxy` — nginx en façade.
- `backup` — conteneur cron qui exécute `pg_dump` quotidien dans un
  volume séparé, rotation 30 jours.

## 6. Sécurité

> **État au 2026-07-29 — l'authentification passe par Keycloak (OIDC).**
> L'interlude sans authentification (PR #36 → #69) est terminé. Le front obtient un jeton par
> *authorization code + PKCE S256* auprès du realm ; l'API le valide en **RS256 via JWKS**, en
> vérifiant l'**émetteur** et l'**audience** — sans ce dernier contrôle, un jeton émis pour une
> autre application du même realm serait accepté.
>
> **Keycloak fait autorité sur l'identité et les rôles.** La table `users` subsiste néanmoins :
> `projects.responsable_id` et `tasks.responsable_id` sont des clés étrangères vers `users.id`.
> Le pont est `users.keycloak_sub` (le `sub` du jeton, stable — contrairement à l'email, qui peut
> changer dans le realm). Au premier passage, le compte est rapproché par `sub`, sinon par email,
> sinon créé ; rôle et email sont resynchronisés à chaque connexion. `users.role` n'est donc qu'un
> **reflet** de Keycloak — ce qui laisse `require_admin` et l'écran de gestion fonctionner tels quels.
>
> **Porte d'entrée** : le rôle `app-projets9-access` conditionne l'accès à cette application.
> Appartenir au realm ne suffit pas. `admin` donne `UserRole.admin`, sinon `membre`. Le refus est
> le défaut : une erreur de configuration ne peut pas ouvrir l'application.
>
> ⚠️ **La configuration Keycloak est obligatoire** depuis le retrait de l'authentification maison
> (2026-07-29). Sans `KEYCLOAK_BASE_URL`/`KEYCLOAK_REALM`, l'API refuse de démarrer ; sans
> `VITE_OIDC_*`, le front affiche « Application mal configurée » au lieu de s'ouvrir. Il n'y a plus
> de repli : ni login maison, ni mode débrayé. Corollaire assumé — **on ne peut plus développer
> sans realm joignable**.

- Authentification obligatoire sur tous les endpoints sauf `/api/health`, volontairement ouvert
  (sonde, ne divulgue rien).
- ~~Mots de passe stockés en bcrypt.~~ → **sans objet** : l'application ne détient plus aucun
  mot de passe. Keycloak authentifie ; la colonne `users.password_hash` a été supprimée
  (migration 0011), pour ne pas conserver des empreintes qui n'ouvrent plus rien.
- ~~JWT court (1h) + refresh.~~ → **assuré par Keycloak** : durée de vie et renouvellement sont
  réglés dans le realm, et le front renouvelle silencieusement (`automaticSilentRenew`). L'API
  n'émet plus de jeton — `POST /api/auth/login` a été retiré avec le reste.
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

### ~~Bascule de développement `AUTH_DISABLED`~~ — retirée le 2026-07-29

Quand elle valait `true`, l'API **ignorait tout token** et exécutait chaque requête en tant que
premier admin actif. Prévue comme confort de développement, elle avait un défaut qu'aucune
discipline ne corrige : son mode de défaillance était silencieux et maximal. Une variable
oubliée à `true` n'ouvrait pas l'application « un peu » — elle donnait les droits
d'**administrateur** à quiconque atteignait le port, sans rien dans les journaux pour le
signaler.

Elle disparaît avec l'authentification maison. Le nouveau mode de défaillance est l'inverse :
mal configurée, l'API **ne démarre pas** et dit quelles variables manquent (garanti par
`tests/test_retrait_auth_maison.py`).

Ce qui en dépendait :
- `scripts/import_data.py` — supprimé, l'import vit dans l'application (Paramètres) ;
- les fixtures de test — elles surchargent `get_current_user`, sans jamais toucher à la
  configuration ;
- le développement local sans realm — **plus possible**, c'est le prix assumé.

### Retrait du login maison (2026-07-29)

Sont partis en même temps : `POST /api/auth/login`, `create_access_token`/`decode_token`,
`hash_password`/`verify_password`, la colonne `users.password_hash`, et le compte administrateur
semé au premier démarrage (`SEED_ADMIN_*`).

Deux raisons de ne pas les garder « au cas où » :
- **un second chemin d'authentification est un second chemin à sécuriser**, avec son propre
  secret (`JWT_SECRET`) et sa propre durée de vie — hors de portée de toute révocation côté
  realm ;
- **l'admin semé** naissait avec un mot de passe par défaut que `.env.example` invitait à
  changer, et que personne ne change.

Conséquence sur une installation neuve : la base ne contient **aucun compte**. Le premier
utilisateur du realm portant `app-projets9-access` et `admin` est créé à sa connexion.

`POST /api/users` subsiste, avec un sens différent : il ne crée plus une identité mais une
**cible de clé étrangère** (`responsable_id`), pour affecter du travail à quelqu'un qui ne s'est
pas encore connecté — ce que fait l'import du classeur avec les chargés de projet. Le
rapprochement avec le realm se fait ensuite par l'email.

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
| format check `black` | ❌ toujours déclaré en dev-dep et **jamais exécuté**. À trancher : `ruff format` fait double emploi et le remplacerait avantageusement. |
| lint front `eslint` | ✅ **corrigé (C1)** : `eslint.config.js` (config plate) créé, étape `Lint` ajoutée au job. ESLint 10 aujourd'hui. |
| type-check `tsc` | ✅ via `npm run build` (`tsc -b && vite build`). |
| tests `pytest` | ✅ vert — les 25 invariants actifs sont couverts (C3), et la suite est **rejouée sur PostgreSQL** (C12b). |
| build images Docker | ✅ mais **plus dans un job dédié** : le job « Docker — build images » a été retiré le 2026-07-28, son `docker build` des 3 images étant déjà fait — et démarré — par le `docker compose up --build` du job DAST. |
| « à chaque push » | ❌ **Révisé en 0.2** : il n'y a plus de déclencheur `push` du tout. Tout ce qui entre dans `main` passe par une PR, donc a déjà été testé ; le rejouer sur le commit de merge ferait doublon. `main` est **protégée depuis le 2026-07-28** (PR obligatoire, status checks en mode *strict*, les 5 contextes) — cf. `INVENTAIRE.md`, chantier C13. |

Ajouté en 2026-07-22 (C12), au vu de l'écart modèles↔migrations constaté : le job `api` a un service
Postgres et une étape `alembic upgrade head` + `alembic check`, pour qu'une divergence entre les
modèles et les migrations **casse le build** plutôt que d'être découverte au prochain `--autogenerate`.

### État au 2026-07-28 — 5 jobs, tous bloquants

Le périmètre a nettement dépassé les 4 points de la 0.1 : sécurité et bout-en-bout s'y sont ajoutés.

| Job | Contenu |
|---|---|
| `api` | `ruff` · Postgres 16 (`alembic upgrade head` + `alembic check`) · `pytest` **deux fois** : SQLite puis **PostgreSQL** (C12b) · sur **Python 3.14**, la version expédiée |
| `web` | `npm ci` → `lint` (ESLint 10) → `test` (Vitest) → `build` (`tsc -b && vite build`) |
| `e2e` | **Playwright** (chromium) sur le planning — API mockée côté navigateur, aucun backend requis |
| `sast` | **Semgrep** `--error`, 8 rulesets — **bloquant au moindre finding** |
| `dast` | **ZAP Baseline** contre la stack complète (qu'il construit et démarre) — bloquant au moindre WARN ; exceptions justifiées dans `.zap/rules.tsv` |

Ajoutés en C15 (SAST/DAST/tests front) et C12b (second passage PostgreSQL). Les dépendances sont
suivies par **Dependabot** avec un *cooldown* de 7 jours (C16).

## 9. Hors périmètre v0

- Import CSV (la *seed* initiale suffit).
- Notifications (mail, Slack).
- Export PDF du Gantt.
- Multi-tenant.
- Mobile dédié (responsive web suffit).
