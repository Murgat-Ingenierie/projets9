FROM postgres:18-alpine

RUN apk add --no-cache busybox-suid

COPY backup.sh /usr/local/bin/backup.sh
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/backup.sh /usr/local/bin/entrypoint.sh

# Sidecar de backup NON exposé (aucun port publié), sur le réseau interne. crond
# a besoin de root pour lire /etc/crontabs. Passer non-root demanderait de retirer
# cron et de gérer les droits du volume — durcissement possible mais à part, avec
# migration prudente du volume existant. Risque faible ici, accepté sciemment.
# nosemgrep: dockerfile.security.missing-user-entrypoint.missing-user-entrypoint
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
