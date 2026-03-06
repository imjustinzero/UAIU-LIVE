#!/usr/bin/env bash
set -euo pipefail
STAMP=$(date +%Y%m%d_%H%M%S)
mkdir -p backups
pg_dump "$DATABASE_URL" > "backups/uaiu_${STAMP}.sql"
echo "backup written: backups/uaiu_${STAMP}.sql"
