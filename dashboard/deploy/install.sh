#!/bin/bash
# Install or update the factory dashboard on the factory host. Run as root from a copy of
# this repository:
#   DASHBOARD_HOST=factory.5.78.214.154.sslip.io DASHBOARD_USER=cam bash deploy/install.sh < password-file
# The password is read from standard input so it never appears in a process list or history.
set -euo pipefail
here=$(cd "$(dirname "$0")/.." && pwd)
: "${DASHBOARD_HOST:?set DASHBOARD_HOST}" "${DASHBOARD_USER:?set DASHBOARD_USER}"
IFS= read -r password
[ -n "$password" ] || { echo "no password on standard input" >&2; exit 2; }

install -d -m 755 /opt/factory-dashboard /var/lib/factory-dashboard /var/lib/factory-dashboard/www
rm -rf /opt/factory-dashboard/src
cp -r "$here/src" /opt/factory-dashboard/
# the built app (web/out) replaces everything in the served folder except the collector's data.json
[ -f "$here/web/out/index.html" ] || { echo "build the app first: cd web && npx next build" >&2; exit 2; }
find /var/lib/factory-dashboard/www -mindepth 1 -maxdepth 1 ! -name data.json -exec rm -rf {} +
cp -r "$here/web/out/." /var/lib/factory-dashboard/www/
rm -f /var/lib/factory-dashboard/www/data.json.example
chmod -R a+rX /var/lib/factory-dashboard/www
install -m 644 "$here"/deploy/factory-dashboard-*.service "$here"/deploy/factory-dashboard-collect.timer /etc/systemd/system/

install -d -m 700 /etc/factory-dashboard
( umask 077; printf '%s:%s' "$DASHBOARD_USER" "$password" > /etc/factory-dashboard/login )
hash=$(printf '%s' "$password" | openssl passwd -apr1 -stdin)
route=$(mktemp)
sed -e "s|HOST|$DASHBOARD_HOST|g" -e "s|USERS|$DASHBOARD_USER:${hash//$/\\$}|" "$here/deploy/traefik.yaml.template" > "$route"
install -m 600 "$route" /data/coolify/proxy/dynamic/factory-dashboard.yaml
rm -f "$route"

systemctl daemon-reload
systemctl enable --now factory-dashboard-collect.timer factory-dashboard-web.service
systemctl restart factory-dashboard-web.service
systemctl start factory-dashboard-collect.service || echo "the first collection failed; see journalctl -u factory-dashboard-collect" >&2
echo "installed; https://$DASHBOARD_HOST"
