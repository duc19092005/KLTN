#!/usr/bin/env bash
set -Eeuo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-.env}"
BACKEND_ENV_FILE="${BACKEND_ENV_FILE:-backend/.env}"
HEALTH_URL="${HEALTH_URL:-http://localhost/api/health}"
PREVIOUS_BACKEND_FILE=".previous_backend_image"
PREVIOUS_FRONTEND_FILE=".previous_frontend_image"

log() { printf '[%s] %s\n' "$(date -Is)" "$*"; }
fail() { log "ERROR: $*"; exit 1; }

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "Missing required command: $1"
}

current_image() {
  local service="$1"
  docker compose -f "$COMPOSE_FILE" ps -q "$service" 2>/dev/null \
    | xargs -r docker inspect --format '{{.Config.Image}}' 2>/dev/null \
    | tail -n 1
}

wait_for_health() {
  log "Checking application health at ${HEALTH_URL}"
  curl --fail --silent --show-error --retry 10 --retry-delay 5 --retry-all-errors "$HEALTH_URL" >/dev/null
}

rollback() {
  log "Starting rollback to previous Docker images"

  if [[ -s "$PREVIOUS_BACKEND_FILE" ]]; then
    export BACKEND_IMAGE
    BACKEND_IMAGE="$(cat "$PREVIOUS_BACKEND_FILE")"
  fi
  if [[ -s "$PREVIOUS_FRONTEND_FILE" ]]; then
    export FRONTEND_IMAGE
    FRONTEND_IMAGE="$(cat "$PREVIOUS_FRONTEND_FILE")"
  fi

  [[ -n "${BACKEND_IMAGE:-}" ]] || fail "Cannot rollback: previous backend image is unknown"
  [[ -n "${FRONTEND_IMAGE:-}" ]] || fail "Cannot rollback: previous frontend image is unknown"

  docker compose -f "$COMPOSE_FILE" up -d --remove-orphans
  wait_for_health || fail "Rollback containers started, but health check still failed"
  log "Rollback completed successfully"
}

on_error() {
  local exit_code=$?
  log "Deployment failed with exit code ${exit_code}"
  rollback || true
  exit "$exit_code"
}
trap on_error ERR

require_cmd docker
require_cmd curl

docker compose version >/dev/null 2>&1 || fail "Docker Compose plugin is not available"
[[ -f "$COMPOSE_FILE" ]] || fail "Missing ${COMPOSE_FILE}"
[[ -f "$ENV_FILE" ]] || fail "Missing ${ENV_FILE}. Create it on the VPS from .env.example"
[[ -f "$BACKEND_ENV_FILE" ]] || fail "Missing ${BACKEND_ENV_FILE}. Create it on the VPS from backend/.env.example"

REQUESTED_BACKEND_IMAGE="${BACKEND_IMAGE:-}"
REQUESTED_FRONTEND_IMAGE="${FRONTEND_IMAGE:-}"
REQUESTED_APP_VERSION="${APP_VERSION:-}"

DOTENV_LIBRARY="$(dirname "${BASH_SOURCE[0]}")/lib/dotenv.sh"
[[ -f "$DOTENV_LIBRARY" ]] || fail "Missing dotenv loader: ${DOTENV_LIBRARY}"
# shellcheck source=scripts/lib/dotenv.sh
source "$DOTENV_LIBRARY"

load_dotenv_file "$ENV_FILE"
load_dotenv_file "$BACKEND_ENV_FILE"

if [[ -n "$REQUESTED_BACKEND_IMAGE" ]]; then BACKEND_IMAGE="$REQUESTED_BACKEND_IMAGE"; fi
if [[ -n "$REQUESTED_FRONTEND_IMAGE" ]]; then FRONTEND_IMAGE="$REQUESTED_FRONTEND_IMAGE"; fi
if [[ -n "$REQUESTED_APP_VERSION" ]]; then APP_VERSION="$REQUESTED_APP_VERSION"; fi

[[ -n "${BACKEND_IMAGE:-}" ]] || fail "BACKEND_IMAGE is required"
[[ -n "${FRONTEND_IMAGE:-}" ]] || fail "FRONTEND_IMAGE is required"

AUDIT_RECOVERY_VAULT_ENABLED="${AUDIT_RECOVERY_VAULT_ENABLED:-false}"
[[ "$AUDIT_RECOVERY_VAULT_ENABLED" == "true" || "$AUDIT_RECOVERY_VAULT_ENABLED" == "false" ]] \
  || fail "AUDIT_RECOVERY_VAULT_ENABLED must be either true or false"

if [[ "${AUDIT_BATCH_DISABLED:-false}" != "true" ]]; then
  if [[ "$AUDIT_RECOVERY_VAULT_ENABLED" == "true" ]]; then
    [[ -n "${VAULT_ADDR:-}" ]] || fail "VAULT_ADDR is required when Vault recovery is enabled"
    [[ -n "${VAULT_TOKEN:-}" ]] || fail "VAULT_TOKEN is required when Vault recovery is enabled"
    [[ -n "${VAULT_AUDIT_TRANSIT_KEY:-}" ]] || fail "VAULT_AUDIT_TRANSIT_KEY is required when Vault recovery is enabled"
  else
    [[ "${AUDIT_ALLOW_LOCAL_RECOVERY_KEY_IN_PRODUCTION:-}" == "true" ]] \
      || fail "AUDIT_ALLOW_LOCAL_RECOVERY_KEY_IN_PRODUCTION must be true"
    [[ "${AUDIT_RECOVERY_ENCRYPTION_KEY:-}" =~ ^[0-9A-Fa-f]{64}$ ]] \
      || fail "AUDIT_RECOVERY_ENCRYPTION_KEY must contain exactly 64 hexadecimal characters"
    [[ "${AUDIT_RECOVERY_ENCRYPTION_KEY}" != "$(printf '00%.0s' {1..32})" ]] \
      || fail "AUDIT_RECOVERY_ENCRYPTION_KEY must not be an all-zero placeholder"
  fi
fi

log "Saving current image references for rollback"
current_image backend > "$PREVIOUS_BACKEND_FILE" || true
current_image frontend > "$PREVIOUS_FRONTEND_FILE" || true

if [[ -n "${GHCR_USERNAME:-}" && -n "${GHCR_TOKEN:-}" ]]; then
  log "Logging in to GHCR"
  printf '%s' "$GHCR_TOKEN" | docker login ghcr.io -u "$GHCR_USERNAME" --password-stdin >/dev/null
else
  log "GHCR credentials not provided; assuming the VPS is already logged in"
fi

export BACKEND_IMAGE FRONTEND_IMAGE
export APP_VERSION="${APP_VERSION:-$(printf '%s' "$BACKEND_IMAGE" | awk -F: '{print $NF}')}"

log "Pulling new images"
if [[ "$AUDIT_RECOVERY_VAULT_ENABLED" == "true" ]]; then
  docker compose --profile vault -f "$COMPOSE_FILE" pull backend frontend nginx postgres kafka vault
  log "Starting database, Kafka, and optional Vault dependencies"
  docker compose --profile vault -f "$COMPOSE_FILE" up -d postgres kafka vault
  COMPOSE_DEPLOY=(docker compose --profile vault -f "$COMPOSE_FILE")
else
  docker compose -f "$COMPOSE_FILE" pull backend frontend nginx postgres kafka
  log "Starting database and Kafka dependencies"
  docker compose -f "$COMPOSE_FILE" up -d postgres kafka
  COMPOSE_DEPLOY=(docker compose -f "$COMPOSE_FILE")
fi

log "Running Prisma production migrations"
"${COMPOSE_DEPLOY[@]}" run --rm --no-deps backend ./node_modules/.bin/prisma migrate deploy

log "Updating application containers"
"${COMPOSE_DEPLOY[@]}" up -d --remove-orphans

wait_for_health

log "Deployment completed successfully"
log "Pruning dangling Docker images only"
docker image prune -f >/dev/null || true
