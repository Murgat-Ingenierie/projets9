#!/bin/sh
set -e

# Tâche cron quotidienne à 03h00
echo "0 3 * * * /usr/local/bin/backup.sh >> /var/log/backup.log 2>&1" > /etc/crontabs/root

# Premier backup au démarrage (utile pour tester)
/usr/local/bin/backup.sh || true

# Sauvegarde à la demande (SPEC §4, écran 11) : l'API dépose un fichier
# sentinelle dans le volume d'échange, on le détecte ici et on lance le MÊME
# script que le cron. L'API n'embarque donc ni pg_dump ni la logique de
# rétention — elle ne peut que *demander*. Le volume des dumps lui est monté en
# lecture seule : elle ne peut ni supprimer ni altérer une sauvegarde.
#
# La sentinelle est retirée AVANT de lancer le dump : si une demande arrive
# pendant une sauvegarde en cours, elle sera honorée au tour suivant plutôt que
# d'être avalée par le `rm` de fin.
TRIGGER_DIR="${BACKUP_TRIGGER_DIR:-/trigger}"
# Un volume Docker nommé appartient à root ; or l'image API tourne en NON-ROOT
# (appuser, uid 10001 — durcissement SAST). Sans ce chown, l'API se prend un
# « Permission denied » en déposant la sentinelle. Ce conteneur-ci est root,
# c'est donc lui qui prépare le terrain, au démarrage.
TRIGGER_UID="${BACKUP_TRIGGER_UID:-10001}"
mkdir -p "$TRIGGER_DIR"
chown "$TRIGGER_UID" "$TRIGGER_DIR"

watch_trigger() {
    while true; do
        if [ -f "$TRIGGER_DIR/backup.request" ]; then
            rm -f "$TRIGGER_DIR/backup.request"
            echo "[backup] demande reçue via l'API — lancement"
            /usr/local/bin/backup.sh || echo "[backup] échec de la sauvegarde à la demande"
        fi
        sleep 5
    done
}
watch_trigger &

# Démarre cron en avant-plan
crond -f -l 8
