#!/usr/bin/env bash
set -Eeuo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-.env}"
BACKUP_DIR="${BACKUP_DIR:-./backups/postgres}"
RETENTION_COUNT="${RETENTION_COUNT:-14}"

log() { printf '[%s] %s\n' "$(date -Is)" "$*"; }
fail() { log "ERROR: $*"; exit 1; }

[[ -f "$COMPOSE_FILE" ]] || fail "Missing ${COMPOSE_FILE}"
[[ -f "$ENV_FILE" ]] || fail "Missing ${ENV_FILE}"
docker compose version >/dev/null 2>&1 || fail "Docker Compose plugin is not available"

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

[[ -n "${POSTGRES_DB:-}" ]] || fail "POSTGRES_DB is required"
[[ -n "${POSTGRES_USER:-}" ]] || fail "POSTGRES_USER is required"

mkdir -p "$BACKUP_DIR"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_FILE="${BACKUP_DIR}/${POSTGRES_DB}_${TIMESTAMP}.sql.gz"

log "Creating PostgreSQL backup: ${BACKUP_FILE}"
docker compose -f "$COMPOSE_FILE" exec -T postgres \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --no-privileges \
  | gzip -9 > "$BACKUP_FILE"

[[ -s "$BACKUP_FILE" ]] || fail "Backup file was not created or is empty"

log "Backup completed: ${BACKUP_FILE}"
log "Keeping latest ${RETENTION_COUNT} backups"
find "$BACKUP_DIR" -maxdepth 1 -type f -name "${POSTGRES_DB}_*.sql.gz" \
  | sort -r \
  | tail -n +$((RETENTION_COUNT + 1)) \
  | xargs -r rm -f
