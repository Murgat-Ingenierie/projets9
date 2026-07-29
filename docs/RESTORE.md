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
