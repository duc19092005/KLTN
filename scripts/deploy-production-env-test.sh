#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/lib/dotenv.sh
source "$SCRIPT_DIR/lib/dotenv.sh"

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT
marker="$tmp_dir/must-not-exist"
valid_env="$tmp_dir/valid.env"
invalid_env="$tmp_dir/invalid.env"

printf '%s\r\n' \
  '# comment' \
  'PLAIN=value' \
  'SPACED=alpha oxvo omega' \
  'DOUBLE_QUOTED="hello world"' \
  "SINGLE_QUOTED='literal value'" \
  'EMPTY=' \
  'HASH=value#literal' \
  'COMMAND=$(touch '"$marker"')' \
  'OPERATORS=one; touch should-not-run' \
  'BACKTICK=`touch should-not-run-either`' > "$valid_env"

load_dotenv_file "$valid_env"

[[ "$PLAIN" == 'value' ]]
[[ "$SPACED" == 'alpha oxvo omega' ]]
[[ "$DOUBLE_QUOTED" == 'hello world' ]]
[[ "$SINGLE_QUOTED" == 'literal value' ]]
[[ -z "$EMPTY" ]]
[[ "$HASH" == 'value#literal' ]]
[[ "$COMMAND" == '$(touch '"$marker"')' ]]
[[ "$OPERATORS" == 'one; touch should-not-run' ]]
[[ "$BACKTICK" == '`touch should-not-run-either`' ]]
[[ ! -e "$marker" ]]

secret='DO_NOT_PRINT_THIS_SECRET'
printf 'VALID=value\ninvalid command %s\n' "$secret" > "$invalid_env"
if error_output="$(load_dotenv_file "$invalid_env" 2>&1)"; then
  echo 'Expected malformed dotenv input to fail' >&2
  exit 1
fi
[[ "$error_output" == *"$invalid_env:2"* ]]
[[ "$error_output" == *'(value redacted)'* ]]
[[ "$error_output" != *"$secret"* ]]

printf 'dotenv parser tests passed\n'