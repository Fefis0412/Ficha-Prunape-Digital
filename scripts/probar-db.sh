#!/usr/bin/env bash
# Levanta un Postgres limpio, aplica el esquema y corre las pruebas de
# aislamiento. Es la forma de verificar que las políticas RLS hacen lo que
# decimos que hacen, sin depender del stack completo de Supabase.
#
#   bash scripts/probar-db.sh
set -euo pipefail

CONTENEDOR=${CONTENEDOR:-prunape-test}
PUERTO=${PUERTO:-5440}
BASE=prunape
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

psql_() { docker exec -i "$CONTENEDOR" psql -U postgres -d "$BASE" "$@"; }

if ! docker ps --format '{{.Names}}' | grep -qx "$CONTENEDOR"; then
  echo "▸ levantando Postgres de pruebas…"
  docker rm -f "$CONTENEDOR" >/dev/null 2>&1 || true
  docker run -d --name "$CONTENEDOR" \
    -e POSTGRES_PASSWORD=test -e POSTGRES_DB="$BASE" \
    -p "$PUERTO:5432" postgres:17-alpine >/dev/null
  for _ in $(seq 1 30); do
    docker exec "$CONTENEDOR" pg_isready -U postgres >/dev/null 2>&1 && break
  done
fi

echo "▸ base limpia"
psql_ -q -v ON_ERROR_STOP=1 -c 'set client_min_messages to warning;
  drop schema if exists public cascade;
  drop schema if exists auth cascade;
  create schema public;
' >/dev/null

echo "▸ aplicando esquema"
psql_ -q -v ON_ERROR_STOP=1 < "$RAIZ/supabase/pruebas/00_stub_auth.sql" >/dev/null
for m in "$RAIZ"/supabase/migrations/*.sql; do
  psql_ -q -v ON_ERROR_STOP=1 < "$m" >/dev/null
done
psql_ -q -v ON_ERROR_STOP=1 < "$RAIZ/supabase/pruebas/01_permisos.sql" >/dev/null

echo "▸ pruebas de aislamiento"
echo
if psql_ -v ON_ERROR_STOP=1 < "$RAIZ/supabase/pruebas/10_rls.sql" 2>&1 \
     | grep -E '^(NOTICE:  )?( *ok |──|═|  TODAS)' | sed 's/^NOTICE:  //'; then
  echo
else
  echo
  echo "✗ las pruebas fallaron" >&2
  exit 1
fi
