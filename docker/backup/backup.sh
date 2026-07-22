#!/bin/sh
# Sauvegarde de la base. Robuste par conception :
#
# - `pipefail` : sans lui, `pg_dump | gzip` renvoie le code de gzip (0) même si
#   pg_dump a échoué en amont — un `.sql.gz` tronqué était alors écrit et compté
#   comme réussi. C'était le défaut principal. (busybox ash le supporte.)
# - Écriture dans un fichier temporaire renommé seulement en cas de succès :
#   le `.sql.gz` final n'apparaît jamais partiel.
# - `gzip -t` vérifie l'intégrité de l'archive avant de la publier.
# - Rétention par âge AVEC un plancher de copies : une longue panne (aucun dump
#   pendant > RETENTION jours) ne peut pas vider le dossier.
set -eu
set -o pipefail

mkdir -p /backups
STAMP="$(date +%Y-%m-%d_%H-%M-%S)"
FINAL="/backups/${PGDATABASE}_${STAMP}.sql.gz"
TMP="/backups/.${PGDATABASE}_${STAMP}.sql.gz.part"

# Nettoie le temporaire quoi qu'il arrive (dump interrompu, gzip corrompu…).
trap 'rm -f "$TMP"' EXIT

pg_dump --no-owner --no-acl "${PGDATABASE}" | gzip -c > "$TMP"
gzip -t "$TMP"                       # refuse une archive corrompue
mv "$TMP" "$FINAL"                   # apparition atomique, fichier entier
echo "[backup] dump → ${FINAL} ($(wc -c < "$FINAL") octets)"

# --- Rétention : par âge, avec plancher de copies --------------------------
RETENTION="${BACKUP_RETENTION_DAYS:-30}"
FLOOR="${BACKUP_MIN_COPIES:-7}"

# Les noms portent l'horodatage : un tri lexical vaut tri chronologique. On
# garde toujours les FLOOR plus récents ; parmi les autres, on ne supprime que
# ceux de plus de RETENTION jours.
recents="$(find /backups -maxdepth 1 -type f -name '*.sql.gz' | sort | tail -n "$FLOOR")"
find /backups -maxdepth 1 -type f -name '*.sql.gz' -mtime "+${RETENTION}" | sort | while IFS= read -r f; do
    [ -z "$f" ] && continue
    if printf '%s\n' "$recents" | grep -qxF "$f"; then
        continue                     # protégé par le plancher
    fi
    rm -f "$f" && echo "[backup] purge $f"
done

echo "[backup] terminé"
