#!/usr/bin/env bash

# Load a Docker-style env file as data. Unlike `source`, this function never
# evaluates command substitutions, shell operators, or executable statements.
load_dotenv_file() {
  local file="$1"
  local line line_number=0 key value

  [[ -f "$file" ]] || {
    printf 'ERROR: Missing dotenv file: %s\n' "$file" >&2
    return 1
  }

  while IFS= read -r line || [[ -n "$line" ]]; do
    ((line_number += 1))
    line="${line%$'\r'}"

    [[ "$line" =~ ^[[:space:]]*$ || "$line" =~ ^[[:space:]]*# ]] && continue

    if [[ ! "$line" =~ ^[[:space:]]*([A-Za-z_][A-Za-z0-9_]*)[[:space:]]*=(.*)$ ]]; then
      printf 'ERROR: Invalid dotenv assignment at %s:%d (value redacted)\n' \
        "$file" "$line_number" >&2
      return 1
    fi

    key="${BASH_REMATCH[1]}"
    value="${BASH_REMATCH[2]}"

    # Remove optional outer whitespace and matching quotes only. All inner
    # characters remain literal, including shell metacharacters.
    value="${value#"${value%%[![:space:]]*}"}"
    value="${value%"${value##*[![:space:]]}"}"
    if (( ${#value} >= 2 )); then
      if [[ "${value:0:1}" == '"' && "${value: -1}" == '"' ]] \
        || [[ "${value:0:1}" == "'" && "${value: -1}" == "'" ]]; then
        value="${value:1:${#value}-2}"
      fi
    fi

    export "$key=$value"
  done < "$file"
}