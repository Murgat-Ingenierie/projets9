#!/bin/sh
set -e

# Tâche cron quotidienne à 03h00
echo "0 3 * * * /usr/local/bin/backup.sh >> /var/log/backup.log 2>&1" > /etc/crontabs/root

# Premier backup au démarrage (utile pour tester)
/usr/local/bin/backup.sh || true

# Démarre cron en avant-plan
crond -f -l 8
