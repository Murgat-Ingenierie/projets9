#!/bin/sh
set -e

mkdir -p /backups
STAMP="$(date +%Y-%m-%d_%H-%M-%S)"
FILE="/backups/${PGDATABASE}_${STAMP}.sql.gz"

echo "[backup] dump → ${FILE}"
pg_dump --no-owner --no-acl "${PGDATABASE}" | gzip > "${FILE}"

RETENTION="${BACKUP_RETENTION_DAYS:-30}"
echo "[backup] rotation > ${RETENTION} jours"
find /backups -type f -name "*.sql.gz" -mtime "+${RETENTION}" -delete

echo "[backup] terminé"
