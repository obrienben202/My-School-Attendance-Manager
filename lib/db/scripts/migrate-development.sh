#!/bin/bash
set -euo pipefail

if [[ "${NODE_ENV:-}" == "production" || -n "${REPLIT_DEPLOYMENT:-}" || -n "${REPLIT_DEPLOYMENT_ID:-}" ]]; then
  echo "Refusing to run the development database migration in a production deployment." >&2
  exit 1
fi

: "${DATABASE_URL:?DATABASE_URL is required}"

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
migrations_dir="${script_dir}/../migrations"

shopt -s nullglob
migration_files=("${migrations_dir}"/*.sql)
if [[ ${#migration_files[@]} -eq 0 ]]; then
  echo "No reviewed development migrations found." >&2
  exit 1
fi

for migration_file in "${migration_files[@]}"; do
  echo "Applying reviewed development migration: $(basename "${migration_file}")"
  psql "${DATABASE_URL}" \
    --set ON_ERROR_STOP=1 \
    --single-transaction \
    --file "${migration_file}"
done