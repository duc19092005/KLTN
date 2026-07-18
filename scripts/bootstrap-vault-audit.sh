#!/usr/bin/env bash
set -Eeuo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
VAULT_SERVICE="${VAULT_SERVICE:-vault}"
VAULT_ADDR="${VAULT_ADDR:-http://127.0.0.1:8200}"
TRANSIT_MOUNT="${VAULT_TRANSIT_MOUNT:-transit}"
TRANSIT_KEY="${VAULT_AUDIT_TRANSIT_KEY:-kltn-audit-recovery}"
POLICY_NAME="${VAULT_AUDIT_POLICY_NAME:-kltn-audit-recovery}"
POLICY_FILE="/vault/policies/audit-recovery.hcl"

fail() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }
vault_exec() {
  docker compose -f "$COMPOSE_FILE" exec -T \
    -e VAULT_ADDR="$VAULT_ADDR" \
    -e VAULT_TOKEN="$VAULT_TOKEN" \
    "$VAULT_SERVICE" vault "$@"
}

[[ -f "$COMPOSE_FILE" ]] || fail "Missing $COMPOSE_FILE"
[[ -n "${VAULT_TOKEN:-}" ]] || fail "Export an authorized VAULT_TOKEN before running this script."

docker compose -f "$COMPOSE_FILE" up -d --no-deps "$VAULT_SERVICE"

status_json="$(docker compose -f "$COMPOSE_FILE" exec -T -e VAULT_ADDR="$VAULT_ADDR" "$VAULT_SERVICE" vault status -format=json 2>/dev/null || true)"
[[ -n "$status_json" ]] || fail "Vault is unreachable."
printf '%s' "$status_json" | grep -q '"initialized": true' || fail "Vault is not initialized. Initialize it manually and securely retain every recovery key."
printf '%s' "$status_json" | grep -q '"sealed": false' || fail "Vault is sealed. Unseal it before bootstrapping Transit."

if ! vault_exec secrets list -format=json | grep -q "\"${TRANSIT_MOUNT}/\""; then
  vault_exec secrets enable -path="$TRANSIT_MOUNT" transit
fi

if ! vault_exec read "${TRANSIT_MOUNT}/keys/${TRANSIT_KEY}" >/dev/null 2>&1; then
  vault_exec write -f "${TRANSIT_MOUNT}/keys/${TRANSIT_KEY}"
fi

vault_exec policy write "$POLICY_NAME" "$POLICY_FILE"
cat <<EOF
Vault Transit is ready.
Create a periodic backend token with:
  docker compose -f $COMPOSE_FILE exec -T -e VAULT_ADDR=$VAULT_ADDR -e VAULT_TOKEN=REDACTED $VAULT_SERVICE \\
    vault token create -policy=$POLICY_NAME -period=24h -orphan
Store only the generated backend token in /opt/kltn/backend/.env; never use the root token there.
EOF
