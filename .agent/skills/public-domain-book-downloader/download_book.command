#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
printf 'Book title: '
read -r TITLE
printf 'Author: '
read -r AUTHOR
printf 'Output directory [%s/downloads]: ' "$ROOT"
read -r OUT
OUT="${OUT:-$ROOT/downloads}"
printf 'Optional local classics_catalog.json path (press Enter to skip): '
read -r CATALOG
ARGS=(fetch --title "$TITLE" --author "$AUTHOR" --out "$OUT" --force)
if [ -n "$CATALOG" ]; then
  ARGS+=(--completion-catalog "$CATALOG")
else
  ARGS+=(--allow-without-completion-catalog)
fi
python3 "$ROOT/scripts/book_source_fetcher.py" "${ARGS[@]}"
printf '\nDone. Output: %s\n' "$OUT"
printf 'Press Enter to close...'
read -r _
