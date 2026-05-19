# Restauration d'un backup

Les dumps `pg_dump` sont stockés dans le volume Docker `backups`.

## Lister les backups disponibles
```bash
docker compose exec backup ls -lh /backups
```

## Déclencher un backup manuel
```bash
docker compose exec backup /usr/local/bin/backup.sh
```

## Restaurer un backup
```bash
# 1. Stopper l'API pour éviter les écritures concurrentes
docker compose stop api

# 2. Recréer la base
docker compose exec db psql -U "$POSTGRES_USER" -c "DROP DATABASE $POSTGRES_DB;"
docker compose exec db psql -U "$POSTGRES_USER" -c "CREATE DATABASE $POSTGRES_DB;"

# 3. Charger le dump
docker compose exec backup sh -c \
  "gunzip -c /backups/<FICHIER>.sql.gz | psql -U postgres -d $POSTGRES_DB"

# 4. Redémarrer l'API
docker compose start api
```

> ⚠️ La restauration écrase les données en cours. Toujours faire un backup
> manuel juste avant si la base contient des données récentes.
