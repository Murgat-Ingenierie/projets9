# Restauration d'un backup

Les dumps `pg_dump` (gzip) sont stockés dans le volume Docker `backups`.

Tout se fait depuis le conteneur **`backup`** : il a `psql`, monte le volume des
dumps, et ses variables `PGHOST` / `PGUSER` / `PGPASSWORD` / `PGDATABASE` sont
déjà positionnées — un simple `psql` s'y connecte à la bonne base, sans avoir à
répéter l'utilisateur ni l'hôte.

## Lister les backups disponibles
```bash
docker compose exec backup ls -lh /backups
```

## Déclencher un backup manuel
```bash
docker compose exec backup /usr/local/bin/backup.sh
```

## Vérifier l'intégrité d'une archive
```bash
docker compose exec backup gzip -t /backups/<FICHIER>.sql.gz
```
Pas de sortie = archive valide. À faire **avant** toute restauration.

## Restaurer un backup

> ⚠️ La restauration **écrase** les données en cours. Prenez d'abord un backup
> manuel si la base contient des données récentes.

```bash
# 1. Stopper l'API pour éviter les écritures concurrentes pendant la restauration
docker compose stop api

# 2. Recréer la base. On se connecte à la base de maintenance « postgres » car
#    on ne peut pas supprimer la base à laquelle on est connecté. Les guillemets
#    échappés protègent le nom réel porté par $PGDATABASE / $PGUSER.
docker compose exec backup sh -c 'psql -d postgres -c "DROP DATABASE IF EXISTS \"$PGDATABASE\";"'
docker compose exec backup sh -c 'psql -d postgres -c "CREATE DATABASE \"$PGDATABASE\" OWNER \"$PGUSER\";"'

# 3. Charger le dump (vérifier son intégrité juste avant)
docker compose exec backup sh -c 'gzip -t "/backups/<FICHIER>.sql.gz"'
docker compose exec backup sh -c 'gunzip -c "/backups/<FICHIER>.sql.gz" | psql'

# 4. Redémarrer l'API (elle rejoue migrations + seed au besoin)
docker compose start api
```

## Restaurer un dump qui ne vient PAS du conteneur `backup`

Un dump reçu par un autre chemin — export d'une autre installation, sauvegarde
récupérée à la main — n'est pas dans le volume `/backups`. Il faut donc l'y
amener, et c'est la seule différence avec la procédure ci-dessus.

```bash
# Le chemin source est relatif au répertoire COURANT, pas à la racine du dépôt.
# Depuis la racine, un fichier rangé dans exports/ s'écrit donc « exports/… » —
# l'oublier donne un « no such file or directory » qui désigne le fichier, pas
# le chemin, et se lit mal.
docker compose cp exports/<FICHIER>.sql backup:/tmp/restaurer.sql
```

Puis les étapes 1, 2 et 4 sans changement, en remplaçant l'étape 3 par :

```bash
docker compose exec backup sh -c 'psql -v ON_ERROR_STOP=1 -q -f /tmp/restaurer.sql'
```

`ON_ERROR_STOP=1` n'est pas décoratif : sans lui, `psql` poursuit après une
erreur et rend la main avec un code de succès sur une base à moitié chargée —
qui démarre, répond, et ne se trahira que plus tard.

Retirer ensuite le fichier du conteneur : il porte des données de production, et
le volume `/tmp` survit aux redémarrages.

```bash
docker compose exec backup sh -c 'rm -f /tmp/restaurer.sql'
```

> **Après une restauration, plus aucun compte n'est lié à Keycloak** si le dump
> est antérieur à la migration `0010` : la colonne `keycloak_sub` est recréée
> vide. Chacun est donc rapproché **par email** à sa première connexion — et un
> compte dont l'adresse ne correspond pas à celle du realm en fait naître un
> second, qui consomme une place sur les dix d'INV-AUTH-2. Corriger les adresses
> **avant** que les personnes se reconnectent ; après, c'est le `keycloak_sub`
> qu'il faut déplacer, ce qui est plus délicat.

Remplacez `<FICHIER>` par le nom exact vu à l'étape « Lister ». À l'étape 3, le
`psql` sans `-d` explicite se connecte à `$PGDATABASE` (la base fraîchement
recréée) via les variables d'environnement du conteneur.

## « Mon dump est plus ancien que le schéma actuel »

C'est le cas normal, et il fonctionne : un dump porte le schéma **du jour où il a
été pris**, y compris sa ligne `alembic_version`. L'étape 4 rejoue les migrations
manquantes par-dessus les données restaurées — c'est tout l'intérêt de redémarrer
l'API plutôt que de s'arrêter à l'étape 3.

Éprouvé le 2026-07-29 sur une base jetable, avec le cas le plus défavorable
disponible : un dump en `0009`, donc antérieur à **deux** migrations, dont une
**destructive** (`0011`, suppression de `password_hash`).

| | avant | après |
|---|---|---|
| `alembic_version` | 0009 | **0011** |
| `keycloak_sub` | absente | ajoutée |
| `password_hash` | présente | supprimée |
| epics / projets / tâches | 13 / 32 / 65 | **13 / 32 / 65** |
| tâches rattachées à un compte | — | 51, aucune clé étrangère orpheline |

Autrement dit : les données traversent, le schéma se met à niveau, les clés
étrangères tiennent. À l'inverse, **un dump plus RÉCENT que le code déployé ne
passera pas** — Alembic ne redescend pas tout seul. Déployer le code d'abord, la
restauration ensuite.
