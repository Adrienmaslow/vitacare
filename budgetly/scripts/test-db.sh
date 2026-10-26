#!/usr/bin/env bash
# Démarre un PostgreSQL local jetable pour les tests d'intégration.
# Usage : bash scripts/test-db.sh start|stop|reset
# En CI, un service PostgreSQL est utilisé à la place (voir .github/workflows/ci.yml).
set -euo pipefail
cd "$(dirname "$0")/.."
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
if [ "$(id -u)" = "0" ]; then DEFAULT_DATA=/tmp/budgetly-pgdata; else DEFAULT_DATA="$PWD/.pgdata"; fi
DATA="${PGDATA_DIR:-$DEFAULT_DATA}"
PORT="${TEST_DB_PORT:-54329}"
URL="postgresql://postgres@localhost:${PORT}/budgetly_test"

# PostgreSQL refuse de tourner en root : on délègue alors à l'utilisateur système "postgres".
run_pg() {
  if [ "$(id -u)" = "0" ]; then
    mkdir -p "$DATA" && chown postgres "$DATA"
    su postgres -s /bin/bash -c "$(printf '%q ' "$@")"
  else
    "$@"
  fi
}

case "${1:-start}" in
  start)
    if [ ! -f "$DATA/PG_VERSION" ]; then
      run_pg "$PGBIN/initdb" -D "$DATA" -U postgres -A trust >/dev/null
    fi
    if ! run_pg "$PGBIN/pg_ctl" -D "$DATA" status >/dev/null 2>&1; then
      run_pg "$PGBIN/pg_ctl" -D "$DATA" -o "-p $PORT -k /tmp" -l "$DATA/server.log" -w start >/dev/null
    fi
    psql -h localhost -p "$PORT" -U postgres -tc "select 1 from pg_database where datname='budgetly_test'" | grep -q 1 \
      || psql -h localhost -p "$PORT" -U postgres -c "create database budgetly_test" >/dev/null
    echo "TEST_DATABASE_URL=$URL"
    ;;
  stop)
    run_pg "$PGBIN/pg_ctl" -D "$DATA" -w stop >/dev/null && echo "arrêté"
    ;;
  reset)
    psql -h localhost -p "$PORT" -U postgres -c "drop database if exists budgetly_test" >/dev/null
    psql -h localhost -p "$PORT" -U postgres -c "create database budgetly_test" >/dev/null
    echo "réinitialisée"
    ;;
esac
