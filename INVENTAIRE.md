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

> **⚠️ MàJ 2026-07-27 — deux mouvements majeurs que ce document ignorait.**
>
> Ce document s'était arrêté au **2026-07-23**. Entre-temps **deux chantiers lourds** ont été livrés
> et fusionnés dans `main` ; une session qui lisait la version précédente sous-estimait le projet
> de deux chantiers. Les sections concernées (§1, §2, §4, §6, §7, §8, §9) sont mises à jour.
>
> **1. L'authentification est passée par un interlude sans auth, puis à Keycloak.** Le login
> maison a été retiré le 2026-07-24 (#36), la protection reportée au périmètre. **Depuis le
> 2026-07-29 (#66 → #69), Keycloak (OIDC) est branché** : code + PKCE S256 côté front, validation
> RS256/JWKS côté API avec contrôle de l'émetteur et de l'audience. Keycloak fait autorité sur
> l'identité et les rôles ; `users.keycloak_sub` fait le pont vers le compte local, que les FK
> `responsable_id` obligent à conserver. **R14 est résolu.** Voir §4.
>
> **2. Le chantier C9 (refacto du Gantt) est TERMINÉ.** Phase 1 (extraction de la logique pure sous
> Vitest, `web/src/planning/*`), puis Phase 2b : réimplémentation complète sur
> `@svar-ui/react-gantt` en 10 incréments (PR #41 → #50), correction du clignotement (#52), et
> **bascule le 2026-07-28 (#54)** — `GanttSvarPage.tsx` sert désormais `/`, l'ancien
> `GanttPage.tsx` (2104 l.) et la dépendance `gantt-task-react` ont été **supprimés**.
> **R5, R9 et R15 sont tombés**, et **React 19** a pu être adopté dans la foulée (#55).
> Voir §9, chantier **C9**.

---

## 1. Démarrage — état vérifié

La procédure du `README.md` (`cp .env.example .env` → `docker compose up --build`) fonctionne,
**après deux correctifs** sans lesquels le démarrage documenté est incomplet :

| Service | État | Note |
|---|---|---|
| `db` | ✅ healthy | Postgres 16, 8 migrations appliquées jusqu'à `0008` |
| `api` | ✅ up | migrations + seed + uvicorn OK |
| `web` | ✅ up | Gantt rendu directement *(plus de login depuis #36 — voir §4)* |
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

> ⚠️ **La vue Gantt est vide au premier démarrage** (« Aucun projet planifié. ») : la seed ne crée
> que les epics.
>
> ✅ **Résolu (2026-07-29)** : l'écran **Paramètres → Import du classeur source** charge l'export
> `.xlsx` du tableur de suivi, à travers les routes de l'API — donc à travers les invariants, avec
> un rapport des lignes refusées. Remplace `scripts/import_data.py`, supprimé avec le login maison
> dont il dépendait pour s'authentifier.

---

## 2. Périmètre fonctionnel — SPEC §4 vs réel

**9 des 11 écrans spécifiés sont livrés, 1 partiel, 1 absent — et 2 écrans non spécifiés existent.**
*(MàJ 2026-07-29 : les écrans 8, 9 et 11 sont livrés (C8). Le « Login » maison n'existe plus, mais
il n'est plus manquant pour autant — il est **remplacé par Keycloak**, qui porte l'écran de
connexion hors de l'application.)*

| # | Écran (SPEC §4) | État | Détail |
|---|---|---|---|
| 1 | Login | ✅ **délégué à Keycloak (#66→#69, 2026-07-29)** | plus d'écran maison : le front redirige vers le realm (code + PKCE S256), l'API valide en RS256/JWKS. Le garde de route est rétabli, et la déconnexion est dans la barre latérale. Inactif tant que la configuration OIDC est vide. |
| 2 | Vue Gantt | ✅ **au-delà de la spec** | zoom Jour/Semaine/Mois, filtres **par équipe**, groupe par epic, undo, drag/resize, multi-sélection + décalage groupé, cascade FS, création/suppression de dépendance au drag, curseur « aujourd'hui », édition/création via EditPanel. Moteur **SVAR** sur `/` depuis la bascule C9 (#54) — moteur unique |
| | ↳ *redimensionnement des projets* | ✅ **livré le 2026-08-04** — ~~écarté le matin même~~ | **Le refus initial reposait sur un motif faux.** Il disait « ses barres n'ont aucune poignée » : en réalité AUCUNE barre n'en a, ni tâche ni projet — le geste se déclenche sur les 20 % extérieurs, et la fonction qui calcule le mode de glissé (`react-gantt`) retourne « rien » pour les seuls types `summary` et `milestone`. Le type était donc l'unique verrou. Les projets sont désormais toujours `task` ; seuls les epics restent `summary` (pas de dates propres, rien à étirer). <br>**Coût réel, celui-là** : SVAR ne décale plus le sous-arbre d'un projet glissé (`moveSummaryKids`), le planning le fait lui-même — même `api.exec` que la cascade. Et il fallait distinguer étirement et déplacement : sans ça, un étirement tombait dans le code de déplacement, dont le delta de début vaut zéro, et disparaissait en silence. <br>**Au passage** : le glissé de barre était réputé non testable en headless. Trop large — horloge figée + vue Jour donnent une géométrie déterministe, et les deux gestes sont couverts par des e2e (`mouse.down/move/up`, assertions sur les requêtes). |
| | ↳ *marque « terminé »* | ✅ **complété le 2026-08-04** | Une tâche archivée portait déjà hachure + coche ; **un projet `réalisé` n'affichait rien** — il fallait ouvrir la ligne pour le savoir. Le drapeau `archived` (nom devenu faux dès qu'il couvre deux entités) est renommé `termine` et posé aussi sur les projets. `abandonne` n'en reçoit pas : le planning ne doit pas affirmer un aboutissement qui n'a pas eu lieu. La coche tire désormais sa couleur du fond (`couleurTexteSur`, comme le libellé depuis #85) — son vert codé en dur passait sur les barres de tâches, éclaircies, mais devenait illisible sur la couleur pleine d'un epic. <br>**Complété** : le nom est aussi **barré dans la colonne de gauche**. Par une règle CSS engendrée depuis les données plutôt que par un rendu de cellule maison — la cellule « Nom » est rendue par SVAR, qui y place le chevron de l'arbre et l'indentation par niveau ; la remplacer coûterait ces deux-là. |
| | ↳ *dépendances masquées par le filtre* | ✅ **le 2026-08-04** | Sous filtre équipe, le planning ne trace un lien que si ses DEUX extrémités sont visibles — choix délibéré (un lien pendant ne veut rien dire, et une cascade déplacerait ce qu'on ne voit pas), mais dont personne n'avait mesuré le coût : une tâche dont les dépendances sortent du périmètre paraissait indépendante. Signalé par l'utilisateur test. Des **flèches fantômes** (moignons en pointillés) apparaissent désormais aux abords de ces tâches, et leur infobulle NOMME les liens cachés (« Dépend de « Pose et calibration » (FS) ») — connaître leur nombre sans pouvoir dire lesquels ne servirait à rien. Rien n'est signalé hors filtre, où les flèches sont toutes dessinées. Logique pure dans `web/src/planning/liensMasques.ts`. <br>**Première tentative écartée** : une icône DANS la barre, invisible dès que le libellé la débordait — c'est-à-dire précisément sur les barres courtes, là où le repère sert le plus. Les moignons sont donc posés HORS de la barre (`.wx-bar` est en `overflow: visible`), à gauche ce qui doit finir avant, à droite ce qu'on retient. <br>*Limite connue* : une barre collée au bord gauche du graphe voit son moignon entrant rogné par `.wx-area` — il n'en reste que la pointe, soit la partie signifiante. Mesuré, pas déduit. |
| | ↳ *tâche hors fenêtre de son projet* | ✅ **rétabli le 2026-08-04** | INV-9 a été supprimé le 2026-07-17 (l'API accepte la mutation), mais le SIGNAL avait disparu avec la bascule SVAR sans que personne ne le remarque : la situation n'était alors ni refusée ni signalée. Les portions de barre hors fenêtre sont de nouveau hachurées en rouge, trait plein à la borne franchie, infobulle disant de quel côté et de combien. Portions fautives seulement, jamais la barre entière. Un cas en base : *vider les bassins du bas* (mai 2026) dans un projet placé en décembre 2028. Logique pure dans `web/src/planning/horsFenetre.ts`. |
| | ↳ *dépassement d'un jalon* | ✅ **tranché par le PO le 2026-08-04** | Un projet **peut** finir après le jalon qui le porte : la hachure rouge reste un signal, pas un verrou. Motif : 4 des 13 rattachements réels dépassent déjà, dont un de 579 jours — l'invariant aurait figé la base. Consigné en parti pris dans `docs/SPEC.md` §*Partis pris*. Question close, ne pas la rouvrir. |
| 3 | CRUD Epics | ✅ | table triable + édition inline |
| | ↳ *écrans étroits* | ✅ **le 2026-08-05** | `/projects`, `/tasks` et leurs formulaires tiennent dans 375 px. Une seule media query (720 px), aucune ailleurs avant. Les tables deviennent des CARTES, repliées par défaut sur le seul nom — une liste de trente projets déroulés sur six lignes ne se parcourt pas au pouce ; les intitulés viennent de `data-label`, l'en-tête étant masqué. Une **recherche libre** (toutes colonnes, insensible aux accents) remplace les filtres par colonne, qui vivent dans cet en-tête ; elle sert aussi sur grand écran. <br>Le planning est délibérément EXCLU : un Gantt sur 375 px n'a pas de sens. <br>Deux défauts trouvés en mesurant : `.form` est une grille dont la piste implicite se dimensionne sur son contenu — un champ `date` la portait à 353 px dans un formulaire de 287, et `width: 100%` héritait de cette largeur (corrigé par `minmax(0, 1fr)`) ; et la case masquée de `Switch`, en `position: absolute` sans ancêtre positionné, prenait toute la largeur de la FENÊTRE via `.form input { width: 100% }` — défaut présent aussi sur grand écran, jamais vu. <br>Contrepartie assumée : les boutons d'une ligne ne sont atteignables qu'une fois sa carte ouverte. |
| 4 | CRUD Projets | ✅ **complété le 2026-08-04** | ~~seule liste sans édition inline~~ épic, nom, dates, responsable et statut s'éditent dans la ligne. « Ouvrir » subsiste : la page de détail porte la description et les tâches, que la ligne ne montre pas. <br>Piège évité et verrouillé par un test : le brouillon d'édition est une COPIE de la ligne, donc il porte `description` — l'envoyer tel quel la transmettait à `null`, et la route (qui applique tout champ fourni) l'effaçait. On n'envoie que les champs de la ligne. |
| | ↳ *sélecteurs requis* | 🐛 **corrigé le 2026-08-04** | Créer un projet échouait sur `body.epic_trigramme : String should have at least 3 characters` alors qu'un epic paraissait choisi. Cause : `EpicSelect`/`ProjectSelect` ne rendaient **aucune option vide** quand le champ était requis. L'état valant `""` ne correspondait alors à aucune option, et le navigateur affichait la PREMIÈRE de la liste — l'écran mentait sur l'état, et le `required` HTML ne bloquait rien puisqu'une option non vide passe pour choisie. Touchait la création de projet et de tâche (pas les éditions inline, dont le brouillon est toujours peuplé). L'option vide est désormais toujours rendue. |
| | ↳ *libellés reliés aux champs* | ✅ **le 2026-08-04** | Aucun `<label>` de l'application ne portait de `htmlFor` : posés en frères du contrôle dans la grille du formulaire, rien ne les associait. Un lecteur d'écran annonçait donc un champ sans nom, et cliquer sur l'intitulé ne plaçait pas le curseur. Repéré en écrivant un e2e, où `getByLabel("Nom")` ne trouvait rien. `useId()` + `htmlFor`/`id` sur les 9 formulaires ; `EpicSelect`, `ProjectSelect`, `UserSelect`, `Switch` et `ProjectMultiSelect` acceptent un `id` pour être visés depuis l'extérieur. Les deux `<label>` qui ENTOURENT leur contrôle (`Switch` en interne, filtre de période de la Charge) restent tels quels : l'association implicite suffit. Verrouillé par `labels.test.tsx`, qui interroge chaque formulaire par `getByLabelText` — le chemin d'association du navigateur lui-même. |
| | ↳ *messages de validation* | ✅ **le 2026-08-04** | Les 422 arrivaient bruts à l'écran : préfixe `body`, nom de colonne, texte anglais. `web/src/api/validationMessage.ts` les traduit à partir de `type` (code machine stable de Pydantic v2, pas du `msg` qui change de version en version) et de `FIELD_LABELS`. Un type non couvert retombe sur le message d'origine — un message anglais juste vaut mieux qu'une traduction qui décrirait mal la contrainte. |
| 5 | CRUD Tâches | ✅ **complété le 2026-08-05** (équipe + todos) | une équipe peut être rattachée **à la création**, avec ses heures. Retour utilisateur. Facultatif, mais indissociable : `tache_equipe.heures_allouees` est NOT NULL avec une contrainte `> 0`, donc « l'équipe seule » n'existe pas — le champ heures apparaît avec l'équipe et devient obligatoire, ce qui fait porter le refus par le navigateur avant l'envoi plutôt que par un 409 après coup. <br>DEUX écritures (la tâche, puis l'allocation qui a besoin de son id) : si la seconde échoue, on ne défait PAS la première — la suppression d'une tâche est réservée aux administrateurs, un membre resterait bloqué au milieu du gué. Le message dit alors exactement ce qui a été fait et où finir le rattachement. <br>En ÉDITION, aucun champ d'équipe : les allocations existantes se règlent dans *Charge équipes*, seul écran où l'on voit la semaine et où une surcharge s'arbitre. <br>**Liste de contrôle (todos)** — retour d'usage, `task_todos` (migration 0012). Points à cocher, PAS des sous-tâches : la hiérarchie s'arrête à Epic → Projet → Tâche. Rendue HORS du `<form>` de la tâche, pour deux raisons — elle écrit immédiatement là où le formulaire attend « Enregistrer », et son champ d'ajout a besoin de sa propre soumission (dedans, Entrée aurait enregistré la TÂCHE ; un e2e le verrouille). En édition seulement : un todo référence sa tâche, qui n'a pas d'identifiant avant d'exister. **Sa suppression est la seule de l'API ouverte aux membres** — la règle administrateur vise la PORTÉE (cascade sur toute la hiérarchie), or un todo n'emporte que lui-même, et c'est la liste qu'on coche en faisant le travail. <br>**Journal d'activité** — retour d'usage, `task_activites` (migration 0013). Horodaté, signé, et **IMMUABLE** : aucune route ne modifie une entrée, le schéma de mise à jour n'existe même pas. Choix INVERSE des todos sur la suppression, pour la raison inverse — elle est réservée aux administrateurs, sinon supprimer puis republier reviendrait à réécrire. La signature vient du JETON, jamais du corps de la requête, et `auteur_nom` est une copie du nom au moment de l'écriture : un journal dit qui a écrit à cette date-là. |
| 6 | CRUD Jalons | ✅ | ~~⚠️ l'édition inline perd les `project_ids`~~ **FAUX, corrigé le 2026-08-04.** Affirmation portée depuis l'inventaire initial et jamais vérifiée : la route emploie `exclude_unset=True` et ne touche aux rattachements que si le champ est FOURNI. L'édition inline les omet, ils sont donc préservés ; le panneau, lui, les recharge et les renvoie. Éprouvé par `tests/test_milestones_maj.py`, qui distingue « champ absent » (ne pas y toucher) de « champ fourni » (remplacer) — rien ne couvrait ce point. |
| 7 | CRUD Dépendances | ✅ **complété le 2026-08-04** | ~~create/delete seulement~~ `PUT /api/dependencies/{id}` change le **type**, et l'écran l'édite directement dans la ligne. Les extrémités restent fixées à la création, délibérément : INV-14 et INV-15 ne dépendent qu'elles, donc tant qu'on n'y touche pas, la modification ne peut rien violer — c'est ce qui dispense la route de les rejouer. Les déplacer suppose toujours de supprimer puis recréer, ce qui repasse par les contrôles. |
| 8 | Page Epic (détail) | ✅ | infos + projets + jalons + **courbe de la Mesure dans le temps** (SVG maison, géométrie pure testée — aucune librairie de graphes) |
| 9 | CRUD Mesures | ✅ | création, édition inline, suppression depuis la page Epic. INV-20 porté par l'UI : l'unité est verrouillée dès qu'une mesure existe. (L'API et le client HTTP existaient déjà — c'était du code mort, cf. R13.) |
| 10 | Gestion utilisateurs (admin) | ✅ | `/users`, nav gatée sur `role === "admin"` |
| 11 | Paramètres / Backup | ✅ | `/parametres` (admin) : déclencher un dump + historique (nom, date, taille). **Sans téléchargement**, délibérément — servir un dump serait un chemin d'exfiltration complet de la base. Le restore reste en CLI (`docs/RESTORE.md`). |

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
| `task_todos` | `id` | FK → task (CASCADE), `libelle` + `fait` — liste à cocher, pas des sous-tâches |
| `task_activites` | `id` | FK → task (CASCADE), journal **immuable** horodaté et signé (`auteur_nom` copié à l'écriture) |

### Points de fragilité

- **`updated_by_id` n'est FK vers rien.** Présent sur 8 tables comme simple `Integer`, sans contrainte
  référentielle (ni modèle, ni migration). Supprimer un user laisse des ids pendants. INV-21 repose dessus.
- **`UserRead` expose un `updated_by_id` toujours `null`** : le schéma hérite de `TimestampedRead` mais
  la table `users` n'a pas cette colonne.
- ~~**Supprimer un projet peut violer INV-6 en silence**~~ ✅ **corrigé (2026-07-22)** : la
  suppression d'un projet ou d'un epic est désormais **refusée (409 INV-6)** si elle orphelinerait
  un jalon (`app/routes/milestone_guard.py`, appelé par `delete_project` et `delete_epic`). Le
  message invite à rattacher le jalon ailleurs ou à le supprimer d'abord.
- **Aucune relation ORM sur `tache_equipe`** (`Task.equipes` / `Equipe.taches` n'existent pas) → jointures manuelles.
- `Milestone.projects` est **unidirectionnel** (pas de `back_populates`).

---

## 4. Surface API

**42 handlers**, 10 routers, tous préfixés `/api/*` dans leur propre module (`main.py` monte sans préfixe).
Le proxy passe `/api/` **sans réécriture** — cohérent par construction.

| Ouvert | Admin uniquement | Authentifié (tout membre) |
|---|---|---|
| `GET /api/health` | gestion des comptes, **suppressions**, `POST /api/import/xlsx` | le reste |

> **MàJ 2026-07-29 — ce tableau est exact, sans réserve.** Il n'y a plus qu'un chemin d'entrée :
> un jeton du realm, validé en RS256/JWKS. « Authentifié » signifie « porteur d'un jeton valide
> **et** du rôle `app-projets9-access` ».
>
> Le mode débrayé (`AUTH_DISABLED`), le login maison et l'admin semé ont été **retirés**. C'est ce
> qui rend le tableau lisible : auparavant, une variable à `true` faisait s'effondrer toutes les
> colonnes en une seule — tout ouvert, en admin, sans rien dans les journaux. Mal configurée,
> l'API **ne démarre plus**.

### Constats

- **RBAC quasi inexistant** : `require_admin` ne garde que la gestion des users. **Tout membre actif peut
  créer/modifier/supprimer n'importe quel epic, projet, tâche, jalon, dépendance, mesure, équipe** — aucun
  contrôle d'appartenance ni de `responsable_id`. `GET /api/users` n'est pas gaté : tout membre énumère les users.
- ~~Le claim `role` du JWT est décoratif~~ → **résolu** : les rôles viennent du jeton Keycloak et
  sont resynchronisés en base à chaque connexion (`auth/provisioning.py`). `users.role` est un
  reflet, `require_admin` le relit.
- ~~`POST /api/auth/login` consomme du JSON, le bouton « Authorize » de Swagger ne marche pas~~ →
  **sans objet** : l'endpoint a disparu, et `tokenUrl` pointe maintenant sur l'endpoint de jeton
  du realm.
- ~~**CORS `allow_origins=["*"]` + `allow_credentials=True`**~~ ✅ **corrigé (C15/SAST, 2026-07-22)** : le wildcard (flaggé par Semgrep) est retiré. CORS désormais opt-in par `CORS_ORIGINS` (vide par défaut = même origine via proxy, aucun CORS ; jamais de `*`).
- Verbes manquants : pas de `PUT` sur `dependencies` (assumé) ; pas de `GET /{id}` sur users, milestones,
  measures, tache-equipe → le front récupère la collection entière pour trouver une ligne.
- ~~Pas de refresh token~~ → **délégué à Keycloak** : durée de vie réglée dans le realm,
  renouvellement silencieux côté front.

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
| INV-6 | `check_milestone_has_projects` + garde `milestone_guard` sur suppression | `milestones.py:37`, `projects.py`/`epics.py` (delete) | U A *(dont orphelinage projet & epic)* |
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
| INV-AUTH-1 | *aucune* — `func.lower(email)` inline, 409 + code | `users.py:58,93` | A *(dont régression `.local`, C11)* |
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

**Après** : **191 tests, 0 xfail** (183 + 2 xfail à la phase 2 ; les deux xfail — `.local` (C11) et
orphelinage INV-6 — sont devenus des tests verts, plus les cas ajoutés au passage). Les 25 invariants
actifs couverts. `test_smoke.py` est retiré —
il annonçait lui-même être un placeholder « avant phase 2 ».

| Fichier | Contenu |
|---|---|
| `tests/test_invariants_unit.py` | 121 tests sur les fonctions `check_*`, cas valides **et** invalides. Aucune dépendance à SQLAlchemy : les checks sont purs et typés par `Protocol`, on leur passe des dataclasses — l'intention posée dès l'origine par la docstring de `checks.py`. |
| `tests/test_invariants_api.py` | 47 tests d'intégration. Prouvent que **la route appelle réellement** le check et surface le bon code. Seul chemin possible pour INV-4, INV-5, INV-AUTH-1 et INV-21, qui n'ont pas de fonction dédiée. |
| `tests/test_invariants_hypothesis.py` | 14 propriétés. Cœur : INV-14 confronté à un **oracle indépendant** (algorithme de Kahn) sur des centaines de graphes générés. |
| `tests/test_couverture_invariants.py` | Garde-fou : échoue si un `InvariantError("INV-…")` apparaît sans test qui le cite, ou si un test attend un code que plus personne ne lève. |
| `tests/conftest.py` | SQLite en mémoire + `TestClient`. L'auth est **injectée** : `get_current_user` est surchargée (en-tête `X-Test-User`), `require_admin` garde sa vraie logique. Le chemin d'authentification lui-même est couvert à part (`test_keycloak_*.py`, `test_retrait_auth_maison.py`) — il n'y a plus de login maison à traverser. |
| `tests/test_retrait_auth_maison.py` | Ce qui ne doit pas revenir : démarrage impossible sans Keycloak, aucune route d'authentification, aucun champ mot de passe au contrat, base sans compte après la seed. |

**Chaque test invalide assert le code `INV-X`**, pas seulement le statut HTTP : l'ID stable est le
contrat entre la SPEC, l'API et le client.

**La suite détecte-t-elle vraiment une régression ?** Vérifié par tests de mutation : 8 invariants
cassés un à un dans `checks.py` (retrait du trim, `>` → `>=`, détection de cycle désactivée…),
**8/8 rattrapés**. Une suite qui passe ne prouve rien ; une suite qui tue ses mutants, si.

**Portée assumée** : les tests d'intégration tournent sur **SQLite en mémoire**, pas sur PostgreSQL.
Ce qui est éprouvé, c'est l'application des invariants par les *routes* — du Python, identique quel
que soit le moteur. En contrepartie, la dernière ligne de défense (contraintes `CHECK` en base) n'est
pas couverte : il faudrait un service PostgreSQL en CI. Arbitrage, pas oubli.

**Plus aucun `xfail` : les deux défauts qui y étaient encodés sont corrigés.** Le mécanisme a joué
comme prévu — un `xfail(strict=True)` passe au vert dès que le bug est corrigé, ce qui fait échouer
la suite (XPASS strict) tant que le marqueur n'est pas retiré. Un défaut connu qui ne pouvait pas
être oublié, puis effacé une fois réglé :
- **`.local`** — corrigé en C11 (validateur d'email maison) ;
- **orphelinage INV-6** — corrigé le 2026-07-22 (garde sur suppression projet/epic, cf. R8 et §3).

> **Second défaut trouvé en écrivant les tests — ✅ corrigé (C11, 2026-07-22).** `UserCreate.email`
> était un `EmailStr`, et `email-validator` **rejette les domaines réservés** comme `.local` → `POST
> /api/users` renvoyait 422, alors que la convention interne du projet est `…@lesfontaines.local`.
> La seed écrivant en base directement (donc passait) et `LoginRequest.email` étant un `str` nu (donc
> la connexion marchait), **l'application ne savait pas créer un compte suivant sa propre convention.**
> Corrigé en remplaçant `EmailStr` par un validateur de format maison qui tolère les TLD internes tout
> en refusant les emails cassés (vérifié : `@…local` → 201, `pas-un-email` → 422). `email-validator`,
> devenu inutile, est retiré des dépendances. L'`xfail` est devenu un test de régression vert.

### La CI aujourd'hui (MàJ 2026-07-28) — 5 jobs, tous bloquants

> Le reste de cette section §6 raconte l'**état d'origine** et sa correction (valeur historique).
> Voici, pour référence rapide, ce que `.github/workflows/ci.yml` exécute **aujourd'hui**, sur
> `pull_request` + `workflow_dispatch` :
>
> | Job | Contenu |
> |---|---|
> | `api` | Ruff + **Postgres 16** (`alembic upgrade head` + `alembic check`) + pytest **deux fois** : SQLite puis **PostgreSQL** (C12b) — sur **Python 3.14**, la version expédiée |
> | `web` | `npm ci` → `lint` (ESLint 10) → `test` (Vitest) → `build` (Vite 8 / TS 6) |
> | **`e2e`** | **Playwright chromium** (`npm run test:e2e`) — API mockée côté navigateur, aucun backend requis |
> | `sast` | **Semgrep** `--error`, 8 rulesets |
> | `dast` | **ZAP Baseline** contre la stack complète. Son `docker compose up --build` construit api/web/backup : il **remplace** l'ancien job `docker` (retiré le 2026-07-28), qui refaisait ces mêmes builds sans les démarrer — redondant et facturé en double sur un plan free. |
>
> Tests front : **12 fichiers** `web/src/planning/*.test.ts` couvrant **les deux** moteurs Gantt,
> plus `web/e2e/{gantt,gantt-svar}.spec.ts`.

### Écarts README ↔ CI réelle *(constat d'origine, corrigé depuis)*

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
> ✅ **La protection est en place depuis le 2026-07-28** (C13) : PR obligatoire, *strict*, les 5
> checks requis, force-push et suppression bloqués. La fenêtre décrite ici — `main` ni protégée ni
> couverte par la CI en cas de push direct — est donc refermée pour les non-admins. Elle reste
> ouverte pour un admin (`enforce_admins: false`, issue de secours assumée).
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
| **Lib Gantt** | `gantt-task-react` « à confirmer » | confirmé, `^0.3.9` — **plus une seconde lib depuis C9 Phase 2b : `@svar-ui/react-gantt` `^2.7.1`** (les deux sont installées, cf. C9) |
| **SS / FF** | types de dépendance légitimes | **jamais dessinés** sur le Gantt (`continue` si `!== "FS"`) — créables mais invisibles |
| **INV-9** | « supprimé, hachure rouge côté UI » | hachure ✅ présente ; fonction morte laissée dans `checks.py` |

---

## 8. Dette & risques classés

| # | Risque | Gravité | Détail |
|---|---|---|---|
| ~~R1~~ | ~~**CI rouge**~~ | ✅ **résolu (étape 0)** | Était rouge depuis le commit initial, à l'étape lint (§6). `ruff check .` et `pytest -q` passent désormais. |
| ~~R2~~ | ~~**Dérive modèles ↔ migrations**~~ | ✅ **résolu (C5, 2026-07-22)** | Modèle aligné : `index=True` déclaré sur les colonnes de `milestone_project` (les index de `0008`), et migration `0009` qui normalise l'unicité `users.email` en un seul index unique (retrait de la contrainte + index non-unique redondants de `0001`). `alembic check` : *No new upgrade operations detected*, y compris sur base vierge. **Verrouillé en CI** par C12 (le check tourne à chaque PR). |
| ~~R3~~ | ~~**1 invariant testé sur 20**~~ | ✅ **résolu (C3)** | Les 25 invariants actifs sont couverts : **191 tests, 0 xfail**, sur 3 couches (unitaire, API, Hypothesis), plus un garde-fou de couverture. Suite éprouvée par mutation : 8/8. |
| R4 | **RBAC : tout membre peut tout détruire** | ✅ **traité (C7 + 2026-08-04)** | Les 8 suppressions métier sont passées en `require_admin` (C7), puis la **création d'une dépendance** l'a rejointe le 2026-08-04. L'asymétrie qui subsistait piégeait les membres : ils traçaient un lien sans pouvoir le retirer, et le bouton « Annuler » du planning échouait lui aussi, puisqu'il passe par un DELETE. **Décision du porteur du produit : fermer la création plutôt qu'ouvrir la suppression.** Côté interface, plus rien n'est proposé qu'on refuse ensuite — `BoutonSupprimer` porte la règle pour les 14 boutons, et le planning masque poignées et corbeille (marqueur `liens-verrouilles`) tout en bloquant les gestes. Rappel : l'interface est un confort, la protection reste les `require_admin`. |
| ~~R5~~ | ~~**Gantt couplé au DOM de la lib**~~ | ✅ **résolu (bascule SVAR, #54, 2026-07-28)** | `gantt-task-react` et son mapping par index DOM ont été **supprimés** avec `GanttPage.tsx`. Le moteur SVAR ne manipule pas le DOM de la lib et n'a aucun `setInterval`. |
| ~~R6~~ | ~~**Backup tolère la corruption**~~ | ✅ **résolu (C6, 2026-07-22)** | `set -o pipefail` (busybox ash le supporte) + écriture dans un `.part` renommé seulement en cas de succès + `gzip -t` : plus de `.sql.gz` tronqué compté comme réussi. Rétention par âge **avec plancher `BACKUP_MIN_COPIES`** (défaut 7) : une longue panne ne peut plus vider le dossier. Testé en isolation (5/5) et cycle backup→restore vérifié contre la stack. **Reste hors périmètre** : aucune copie hors-volume (choix d'infra — S3/NAS — à la charge du déploiement). |
| ~~R7~~ | ~~**Pas de lockfile npm**~~ | ✅ **résolu (C1)** | `web/package-lock.json` est versionné et la CI fait `npm ci` sans repli. Cette ligne décrivait l'état d'avant C1. |
| ~~R8~~ | ~~**Jalons orphelins**~~ | ✅ **résolu (2026-07-22)** | La suppression d'un projet/epic qui orphelinerait un jalon est refusée (409 INV-6, `milestone_guard`). Vérifié end-to-end (4/4) et par test (projet & epic, + cas permis). |
| ~~R9~~ | ~~**`GanttPage.tsx` = 2104 lignes**~~ | ✅ **résolu (bascule SVAR, #54)** | Le fichier n'existe plus. Le planning tient en **571 lignes** (`GanttSvarPage.tsx`), logique métier extraite et testée dans `web/src/planning/*`. |
| R10 | **Refetch ciblé : une exception, le reste assumé** | 🟢 **arbitré le 2026-08-05** | Chaque mutation du planning relance **7 requêtes**. Mesuré sur les données réelles : **~42 ko**, émis EN PARALLÈLE (un aller-retour, pas sept), et **une action = un seul `reload()`** — les cascades groupent leurs écritures. Pas de défaut visible : le clignotement qu'on lui imputait avait une autre cause, corrigée en #52. <br>**Décision : on garde le rechargement global.** Le ciblage économiserait surtout les petites collections — tâches et projets pèsent 30 ko sur 42 et sont ce que la plupart des mutations touchent. On paierait un risque réel (chaque mutation devrait déclarer ce qu'elle invalide, et un oubli laisse l'écran afficher des données périmées, sans bruit) pour 12 ko. **Seuil mesuré** : vers 10× ces volumes (~760 tâches, ~400 ko par mutation). <br>**Une exception, prouvable** : créer ou supprimer un lien du planning n'écrit que dans `dependencies` — aucune tâche déplacée, la cascade FS ne se déclenchant qu'au glissé d'une barre. Ce sont aussi les gestes les plus répétés. `reloadDependances()` y ramène 42 ko à 3,8. Un e2e verrouille l'hypothèse : il échoue si les six autres collections repartent. |
| ~~R11~~ | ~~`docs/RESTORE.md` : `psql -U postgres`~~ | ✅ **résolu (C6)** | Runbook réécrit et cohérent (tout via le conteneur `backup`, qui a `psql` + le volume + les variables `PG*`). Vérifié : le cycle documenté restaure réellement (marqueur post-backup disparu, données revenues). |
| ~~R12~~ | ~~`scripts/` non lintés, deps non déclarées~~ | ✅ **résolu (2026-07-28)** | `ruff check ../scripts` ajouté au job `api` (mêmes règles que l'API) : 2 blocs d'imports mal triés dormaient là, non détectés faute de linter. `playwright` — la dernière dépendance non déclarée — l'est désormais dans un extra `[inspect]` dédié (lourd, utile au seul `inspect_gantt.py`) ; `requests`/`openpyxl` l'avaient été en C14. Au passage, `inspect_gantt.py` visait encore `svg g[tabindex]`, le DOM de l'ancien Gantt supprimé → sélecteur SVAR. |
| ~~R13~~ | ~~Code mort~~ | ✅ **soldé le 2026-08-04** | ~~INV-9/INV-13 (§5)~~ purgés en étape 0, ~~`Boolean` (epic)~~ retiré par `ruff --fix`, et les deux derniers restes supprimés : `_slug()` (`app/seed.py`, défini sans aucun appelant — son unique dépendance `import unicodedata` part avec ; `re` reste, il valide encore les trigrammes) et `equipes.get` (`web/src/api/endpoints.ts`, déclaré sans jamais être appelé). **La route API `GET /api/equipes/{id}` est conservée** : elle existe et fonctionne, c'est l'aide côté client qui était morte — et `get` n'est pas un motif systématique du module, seul `epics` en a un, effectivement utilisé. ~~`nav`/`navState` (GanttPage)~~ : **jamais mort**, `navState` sert dans `DependenciesPage` et `EpicDetailPage`. |
| ~~R17~~ | ~~**Le proxy perdait l'API à chaque redéploiement**~~ | ✅ **résolu (2026-08-05)** | Un bloc `upstream { server api:8000; }` résout le nom UNE fois, au chargement, et garde l'adresse indéfiniment. Docker en réattribue une autre à la recréation d'un conteneur : après un rebuild `--no-cache`, nginx parlait à une adresse qui n'était plus la sienne et répondait 502 jusqu'à ce qu'on le redémarre LUI. **Reproduit avant correction** (api déplacée de .4 à .7, nginx toujours sur .4 → 502), puis **vérifié après** : api déplacée de .2 à .8, proxy NON redémarré, 200. Correction : `resolver 127.0.0.11 valid=10s ipv6=off` + cibles passées par des VARIABLES — c'est la variable qui diffère la résolution, une cible écrite en dur serait de nouveau figée. Aucune ne porte de chemin, sinon l'URI de la requête serait REMPLACÉE (`/api/health` deviendrait `/`) ; les quatre routes ont été éprouvées. |
| ~~R14~~ | ~~**L'app expédiée tourne sans authentification**~~ | ✅ **résolu (#66 → #69, 2026-07-29)** | Keycloak (OIDC) est branché : code + PKCE S256 côté front, validation RS256/JWKS côté API avec contrôle de `iss` et `aud`. Porte d'entrée `app-projets9-access`, refus par défaut. **Condition levée (#74, 2026-07-29)** : le mode débrayé, le login maison et l'admin semé sont retirés. La configuration Keycloak est obligatoire — sans elle l'API ne démarre pas, le front affiche un message de configuration. Plus aucun chemin ne contourne le realm. |
| ~~R15~~ | ~~**Deux moteurs Gantt en parallèle**~~ | ✅ **résolu (#54)** | L'ancien moteur et sa lib ont été retirés. Effet de bord acquis : **React 19** n'est plus bloqué (#55). |

| ~~R16~~ | ~~**Les comptes importés ne se rapprocheront pas de Keycloak**~~ | 🟡 **traité en base le 2026-07-29, reste à confirmer aux premières connexions** | L'import fabrique les adresses des chargés de projet (`slug_email()` : nom concaténé + `@lesfontaines.fr`, domaine choisi parce qu'`email-validator` refuse `.local`). Elles ne désignaient aucune boîte réelle, or le rapprochement d'un jeton se fait par `keycloak_sub` puis **à défaut par email** : chaque chargé de projet se serait vu créer un **second** compte, laissant ses tâches sur le fantôme et consommant deux places sur les 10 d'INV-AUTH-2. **Charles a corrigé les adresses directement en base**, comme prévu — vérifié le 2026-07-29 : plus aucune adresse fabriquée, aucune capitale (le rapprochement fait une égalité EXACTE sur l'email minuscule du jeton, une capitale suffirait à recréer le doublon), 51 tâches toujours rattachées, 6 comptes actifs sur 10. **Ne pas « réparer » `slug_email`** : le format est délibéré, c'est le rapprochement qui est manuel. **Deux restes** : (a) ~~le compte de l'ancien admin de seed (`@lesfontaines.local`, 0 tâche, jamais connecté) est un administrateur fantôme qui occupe une place — à supprimer~~ ⛔ **classé sans suite le 2026-08-04, décision de Charles** : ce compte n'existe pas en production, il ne subsiste que sur la base locale. Ne consomme donc aucune des 10 places d'INV-AUTH-2 là où ça compte. Ne pas rouvrir ; (b) le `sub` PRIME sur l'email, donc un compte déjà lié à Keycloak restera gagnant même si l'on repointe l'email d'un compte importé vers la même personne : pour consolider, c'est le `keycloak_sub` qu'il faut déplacer vers le compte porteur des tâches. |

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
| **C11** | ✅ **Fait (2026-07-22).** `EmailStr` remplacé par un validateur de format maison qui tolère les TLD internes (`.local`) sans tout accepter. Vérifié end-to-end (`@…local` → 201, email cassé → 422) et par test (l'ancien `xfail` est un test vert, + 4 cas de rejet). `email-validator` retiré des deps (devenu inutile). *Piste initialement notée `test_environment=True` : écartée — vérifié qu'email-validator refuse `.local` sous tous ses réglages.* | L'app ne savait pas créer un compte suivant sa propre convention | S |
| **C12** | ✅ **Fait (2026-07-22).** Service `postgres` ajouté au job `api` ; étape « Migrations + contrôle de dérive » : `alembic upgrade head` (les migrations tiennent sur base vierge) + `alembic check` (verrouille C5 — toute dérive modèle/migration future casse la CI). **C12b ✅ fait (2026-07-28)** : la suite pytest est désormais **rejouée sur PostgreSQL** dans le même job (`TEST_DATABASE_URL`, base dédiée `gestion_test` pour ne pas piétiner le schéma d'alembic). SQLite reste le défaut en local (rapide, aucun service à lancer). Nouveau `tests/test_contraintes_base.py` : 4 tests qui **contournent les routes** et écrivent en base directement, pour éprouver la dernière ligne de défense — les 3 `CheckConstraint` (honorées par les deux moteurs) et le refus d'une valeur **hors type ENUM natif**, que SQLite ne peut pas fournir (test ignoré hors PostgreSQL, raison affichée). Vérifié : **204 tests** sur PostgreSQL, **203 + 1 ignoré** sur SQLite. | La dérive migrations n'était pas détectée en CI | M |
| **C13** | ✅ **Fait (2026-07-28).** `main` est protégée : PR obligatoire, **strict** (branche à jour ⇒ l'état testé EST l'état fusionné), les **5 checks** requis, force-push et suppression bloqués. Devenu possible parce que le dépôt est repassé **public** (la protection de branche n'existe pas sur dépôt privé en plan free) — donc **lié à ce choix** : repasser en privé la ferait perdre. **Le dépôt RESTE public — tranché le 2026-08-04.** Motif : les minutes GitHub Actions sont gratuites sur dépôt public et décomptées d'un quota sur dépôt privé ; au rythme actuel (5 jobs bloquants par PR, plusieurs PR par jour) le quota serait consommé rapidement. Question close. `enforce_admins: false` volontairement : issue de secours, la barrière est ferme pour les non-admins et contournable pour un admin. | Sans protection, retirer `push:` laisse `main` sans filet | XS |

### C13 — réglage appliqué (référence)

Le dépôt est **public** et `main` n'a aucune règle. À poser dans
*Settings → Branches → Add branch protection rule*, sur `main` :

| Réglage | Valeur | Pourquoi |
|---|---|---|
| Require a pull request before merging | ✅ | C'est **le** réglage qui bloque les push directs. |
| Required approving reviews | **0** | ⚠️ Mettre 1 verrouillerait le dépôt : GitHub interdit d'approuver sa propre PR, et l'équipe tient sur une personne. |
| Require status checks to pass | ✅ | Les **5** contextes, au caractère près (ils contiennent un tiret cadratin) : `API — lint + tests`, `Web — lint + build`, `E2E — Playwright (planning)`, `SAST — Semgrep`, `DAST — ZAP Baseline`. *(`Docker — build images` en faisait partie jusqu'au 2026-07-28 ; le job a été retiré, cf. §6 — un contexte requis qui n'est plus produit bloquerait toutes les PR.)* |
| **Require branches to be up to date** (*strict*) | ✅ | **Le réglage critique.** C'est lui qui rend le retrait du déclencheur `push` légitime : il garantit que l'état testé par la PR **est** l'état fusionné. |
| Allow force pushes / deletions | ❌ | |
| Include administrators | au choix | Le laisser décoché garde une issue de secours en cas d'urgence. |

Équivalent en ligne de commande, pour un compte administrateur :

```bash
gh api -X PUT repos/Murgat-Ingenierie/projets9/branches/main/protection --input - <<'JSON'
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["API — lint + tests", "Web — lint + build", "E2E — Playwright (planning)", "SAST — Semgrep", "DAST — ZAP Baseline"]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": {"required_approving_review_count": 0},
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
JSON
```
| **C4** | 🟡 **Volet démo fait (2026-07-22).** `app/seed_demo.py` : jeu de démonstration réaliste (4 projets, 13 tâches, 10 dépendances, 3 jalons, 3 équipes, 7 allocations, 4 mesures), activable par `SEED_DEMO=true` ou `python -m app.seed_demo`. Idempotent, auto-validé contre les 25 invariants avant commit. Vérifié end-to-end : Gantt peuplé (groupe par epic, pastille terminé, hachure hors-fenêtre, flèches, jalons), vue Charge avec surcharge rouge à 142 %. **Reste** : le volet « usage réel » (fiabiliser/documenter l'import du vrai tableur) — voir C14. | Le produit ne démontrait rien au premier lancement | M |
| **C14** | ✅ **Fait (2026-07-29, #73).** L'import vit dans l'application : **Paramètres → Import du classeur source**, réservé aux admins, avec rapport des lignes refusées. La logique du script a été **déplacée** (pas réécrite) dans `app/services/import_xlsx.py`, et `ClientEnProcess` dispatche ses appels vers les **fonctions de route** : les invariants restent appliqués par le code qui les applique déjà. `scripts/import_data.py` supprimé — il s'authentifiait sur le login maison, parti avec Keycloak. 12 tests, dont le cas réel INV-10 reproduit. <br><br>*Historique :* 🟡 **Script réparé (2026-07-22).** `import_data.py` était **plus cassé que l'inventaire ne le disait** : au-delà des deps/port, il était désynchronisé de l'API (tâches en `statut: prevu/realise` + `avancement` → 422 ; jalons en `project_id: None` + `epic_trigramme` → 422 ; `--token` promis mais absent). Réparé contre le schéma actuel, deps déclarées (`.[scripts]`), auth par `--email/--password`. `make_sample_source.py` génère un classeur d'exemple conforme (spec exécutable). Vérifié end-to-end : import en 0 refus, comptes exacts, idempotent, INV-18/INV-6 respectés, responsables rapprochés par nom. **Reste** : lancer l'import sur le **vrai** `data/source.xlsx` (hors dépôt) — nécessite le fichier de Charles, et de confirmer que sa structure correspond au format attendu. | La seed de démo montre le produit ; elle ne charge pas les vraies données | M |
| **C5** | ✅ **Fait (2026-07-22).** `index=True` sur les colonnes de `milestone_project` + migration `0009` normalisant l'unicité `users.email`. `alembic check` vert (base existante ET vierge). Verrouillé en CI par C12. | `autogenerate` produisait du churn d'index | S |
| **C6** | ✅ **Fait (2026-07-22).** `pipefail` + `.part` atomique + `gzip -t` (fin des dumps tronqués) ; rétention à plancher `BACKUP_MIN_COPIES` (fin du vidage possible) ; `RESTORE.md` réécrit et corrigé. Testé : logique 5/5 en isolation, backup réel intègre (11 tables), cycle backup→restore validé contre la stack (R6, R11). | Un backup non vérifié n'est pas un backup | S |
| **C7** | ✅ **Fait (2026-07-29).** Les **8 suppressions métier** passent en `require_admin` ; création et modification restent ouvertes à tout membre (travail quotidien, réversible). Décision prise au vu de la **portée réelle** d'un `DELETE` : les FK sont en CASCADE sur toute la hiérarchie, donc `DELETE /api/epics/{tri}` emportait jusqu'à 9 projets et 34 tâches sur les données réelles — accessible à n'importe quel membre. `GET /api/users` est également réservé aux admins (seul écart réel à la SPEC §6) ; un nouvel **`/api/users/annuaire`** (id + nom, comptes actifs) reste ouvert, sans quoi l'affectation d'un responsable aurait cassé pour les non-admins. 13 tests, dont le versant négatif (un membre est refusé) et la preuve qu'un refus ne détruit rien. | Écart à la SPEC §6 | M |
| **C8** | ✅ **Fait (2026-07-28).** Les 3 écrans manquants de la SPEC §4 sont livrés. **Écrans 8 et 9** (#59) : courbe de la mesure dans le temps (SVG maison, géométrie pure sous 10 tests — aucune librairie de graphes ajoutée) + CRUD des mesures depuis la page Epic, avec INV-20 porté par l'UI (unité verrouillée dès qu'une mesure existe). L'API était déjà complète : `create`/`update`/`remove` existaient **sans être appelés** (code mort R13). **Écran 11** : page `/parametres` (admin) — déclencher un dump + historique, **sans téléchargement** (servir un dump serait un chemin d'exfiltration complet ; le restore reste en CLI). L'API ne fabrique pas les dumps : elle dépose une sentinelle que le conteneur `backup` scrute, et le volume des sauvegardes lui est monté **en lecture seule** — vérifié : `Read-only file system`. | SPEC §4 incomplet | M |
| **C9** | 🟡 **Très avancé (2026-07-24 → 27) — il ne reste que la bascule.** Détail complet en **§C9** ci-dessous. Phase 1 ✅ (logique pure extraite sous Vitest dans `web/src/planning/*`) ; Phase 2b ✅ (**réimplémentation entière sur SVAR**, PR #41→#50, en parité fonctionnelle validée en aperçu live). Clignotement post-mutation ✅ **corrigé (#52, 2026-07-28)**, vérifié en live. **Reste la bascule `/planning-svar` → `/`** puis la suppression de l'ancien moteur + `gantt-task-react`. Tant qu'elle n'est pas faite, **R5/R9/R15 restent actifs** et le gain n'est pas livré à l'utilisateur. | Zone la plus fragile et la plus active du dépôt | L |
| **C16** | ✅ **Fait (2026-07-23) — Dependabot.** Mises à jour hebdomadaires avec **cooldown 7 jours** (n'adopte une release qu'après 7 j — protection supply-chain, et exigée par la règle SAST `dependabot-missing-cooldown`). 4 écosystèmes (pip, npm, github-actions — garde les SHA épinglés à jour —, docker). Minor/patch groupés, majeures individuelles. **TypeScript 7 refusé d'office** (pas supporté par typescript-eslint). Passe le gate SAST (0 finding). | Boucler l'automatisation des dépendances (supply-chain) | S |
| **C15** | ✅ **Fait (2026-07-23) — durcissement CI/tests.** 3 volets, tous bloquants : ✅ tests front (Vitest) ; ✅ **SAST Semgrep** (`--error`, 8 rulesets) ; ✅ **DAST ZAP Baseline** (bloquant sur tout WARN). SAST : CORS wildcard corrigé, API + (rappel) actions épinglées, backup non-root traité en C15/SAST, 2 baselines `nosemgrep`. DAST : 5 en-têtes de sécurité ajoutés au proxy (X-Frame-Options, X-Content-Type-Options, `server_tokens off`, Permissions-Policy, **CSP stricte** `script-src 'self'`) ; Swagger préservé via une CSP assouplie **par-location** (`/api/docs`,`/redoc`) ; app vérifiée fonctionnelle sous CSP (login, Gantt, fonts, 0 violation) ; 5 alertes bas-risque/informationnelles ignorées avec justification (`.zap/rules.tsv`). | Élever le filet avant le gros refacto C9 | M |

### C9 — état détaillé du chantier Gantt (MàJ 2026-07-27)

> **Où on en est en une phrase** : le nouveau Gantt existe, il est en parité fonctionnelle et sous
> tests — mais **l'utilisateur voit toujours l'ancien**, parce que la bascule n'a pas été faite.

**Phase 1 — extraire la logique pure sous tests ✅** (PR #35, #37, #38, #39)

Toute la logique non-DOM a été sortie du monolithe vers `web/src/planning/`, chaque module avec son
test Vitest : `dates.ts`, `dependencies.ts` (maps + cascade FS), `useUndo.ts` (pile d'annulation),
`usePlanningData.ts` (le chargement 7-requêtes), `buildGanttTasks.ts`, `ganttStyles.ts`.
Effet mesurable : `GanttPage.tsx` passe de **2332 à 2104 lignes**, et la logique métier devient
testable sans navigateur.

**Phase 2b — réimplémentation sur SVAR ✅** (PR #41 → #50, `@svar-ui/react-gantt` `^2.7.1`)

`web/src/pages/GanttSvarPage.tsx` — **571 lignes contre 2104**, sans manipulation impérative du DOM
de la lib, sans `setInterval`, sans mapping par index. Livré en 10 incréments, **chacun validé en
aperçu live** (Docker `:8080`) avant merge :

| Incrément | PR |
|---|---|
| Fondation du planning SVAR | #41 |
| Drag → persist → rollback | #42 |
| Liens (dépendances) create/delete → persist → rollback | #43 |
| Restauration des icônes (mapping → Material Symbols) | #44 |
| Cascade FS + décalage de groupe au drag | #45 |
| Zoom Jour/Semaine/Mois + curseur « aujourd'hui » | #46 |
| Filtre équipe + group-by-epic | #47 |
| Réactivité (état déplié, reload post-mutation, cascade pleine parité) | #48 |
| Décorations des barres (couleur epic, archivées, sélection) | #49 |
| Annulation (Ctrl+Z) des mutations | #50 |

Tests : `web/src/planning/{buildSvarTasks,buildSvarLinks,svarAdapter,cascadeShifts,teamFilter}.test.ts`
+ un e2e Playwright `web/e2e/gantt-svar.spec.ts`, et un job CI **`e2e`** dédié.

**Clignotement post-mutation — ✅ corrigé (#52, 2026-07-28)**

Le diagnostic initial (« c'est `reload()` qui refait 7 requêtes ») était **faux**. La vraie cause était
dans le wrapper React de SVAR, qui ré-initialise **tout son store** depuis un effet dont les
dépendances contiennent la prop `init` :

```js
const c = V(0);
ie(() => { c.current ? I.init(m) : B && B(b); c.current++; }, [b, B, m, I]);
//                     ^^^^^^^^^ ré-init COMPLET        ^ B = la prop `init`
```

`onInit` étant défini en ligne dans le composant, il était recréé à **chaque rendu** → ré-init
complet du Gantt à chaque rendu. Un simple drag re-rend 3 fois (`setErr`, `pushUndo`, puis les
`setState` de `reload`) : 3 ré-inits en cascade. *(C'est aussi ce qui expliquait le contournement
`openStateRef` : l'état déplié était perdu à chaque ré-init.)*

Correctifs : `onInit` en `useCallback` (deps `[reload, pushUndo]`, toutes deux stables) + nouveau
`useStableList` (`web/src/planning/useStableList.ts`) qui ne propage `tasks`/`links` que sur
changement de **contenu** — car `reload()` reconstruit ces tableaux même quand rien n'a bougé.
Verrouillé par `web/src/pages/GanttSvarPage.test.tsx` (stabilité d'identité des props reçues par
`<Gantt>`), tests **vérifiés en échec** sur le code d'origine. Disparition confirmée en live.

**Ce qui reste**

**La bascule `/planning-svar` → `/`.** C'est la vraie fin du chantier : router le nouveau moteur
sur `/`, le remettre dans la nav, **puis supprimer** `GanttPage.tsx`, ses modules propres et la
dépendance `gantt-task-react`. C'est ce qui fait tomber **R5, R9, R15** — et qui débloque au
passage **React 19** (aujourd'hui refusé par le peer `react ^18` de l'ancienne lib).

**Pièges déjà payés sur SVAR — à ne pas re-découvrir**

- **Les props `init`, `tasks` et `links` doivent être stables en IDENTITÉ** : tout changement de
  référence ré-initialise l'intégralité du store (cf. ci-dessus). `init` → `useCallback` ;
  `tasks`/`links` → `useStableList`. Ne jamais repasser à une fonction/tableau recréé au rendu.

- **Dessiner un lien = DEUX CLICS**, pas un drag (clic sur la poignée source, puis sur la cible ; le
  type se déduit des côtés : droite→gauche = FS). Ce geste **est** pilotable en headless → couvert
  par l'e2e.
- **Déplacer/redimensionner une barre et supprimer un lien** reposent sur le DnD `mousedown` natif :
  **non pilotables de façon stable en headless** → à valider en **aperçu live**, pas en e2e.
- **Aucune police d'icônes n'est livrée par le paquet SVAR** (et la CSP bloque son CDN) : tous les
  `<i class="wxi-…">` seraient vides. Corrigé en #44 par un mapping vers **Material Symbols** (déjà
  chargée, même origine, compatible CSP). Symptôme trompeur : une icône de hauteur 0 n'est pas une
  cible de clic — « rien ne se passe » n'était pas un bug de handler.
- **Le store SVAR indexe par ids sans préfixe** (`task:11`, `proj:1`…) ; le `data-id=":task:11"` du
  DOM est cosmétique.
