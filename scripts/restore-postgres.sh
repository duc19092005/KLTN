#!/usr/bin/env bash
set -Eeuo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-.env}"
BACKUP_FILE="${1:-}"

log() { printf '[%s] %s\n' "$(date -Is)" "$*"; }
fail() { log "ERROR: $*"; exit 1; }

[[ -n "$BACKUP_FILE" ]] || fail "Usage: $0 <backup-file.sql.gz>"
[[ -f "$BACKUP_FILE" ]] || fail "Backup file not found: ${BACKUP_FILE}"
[[ -f "$COMPOSE_FILE" ]] || fail "Missing ${COMPOSE_FILE}"
[[ -f "$ENV_FILE" ]] || fail "Missing ${ENV_FILE}"
docker compose version >/dev/null 2>&1 || fail "Docker Compose plugin is not available"

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

[[ -n "${POSTGRES_DB:-}" ]] || fail "POSTGRES_DB is required"
[[ -n "${POSTGRES_USER:-}" ]] || fail "POSTGRES_USER is required"

cat <<WARNING
You are about to restore PostgreSQL database '${POSTGRES_DB}' from:
  ${BACKUP_FILE}

This is destructive for current data. It is NOT part of automatic deploy rollback.
Type exactly 'RESTORE ${POSTGRES_DB}' to continue.
WARNING

read -r CONFIRMATION
[[ "$CONFIRMATION" == "RESTORE ${POSTGRES_DB}" ]] || fail "Restore aborted"

log "Stopping application containers before restore"
docker compose -f "$COMPOSE_FILE" stop backend frontend nginx || true

log "Dropping and recreating database ${POSTGRES_DB}"
docker compose -f "$COMPOSE_FILE" exec -T postgres psql -U "$POSTGRES_USER" -d postgres \
  -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${POSTGRES_DB}' AND pid <> pg_backend_pid();" \
  -c "DROP DATABASE IF EXISTS \"${POSTGRES_DB}\";" \
  -c "CREATE DATABASE \"${POSTGRES_DB}\" OWNER \"${POSTGRES_USER}\";"

log "Restoring backup"
gzip -dc "$BACKUP_FILE" | docker compose -f "$COMPOSE_FILE" exec -T postgres \
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"

log "Restore completed. Start the stack with: docker compose -f ${COMPOSE_FILE} up -d"
