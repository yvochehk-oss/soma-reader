#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
if [ "$#" -lt 2 ]; then
  echo 'Usage: ./download_book.sh "Book Title" "Author Name" [output_dir] [catalog_json]'
  exit 2
fi
TITLE="$1"
AUTHOR="$2"
OUT="${3:-$ROOT/downloads}"
CATALOG="${4:-}"
ARGS=(fetch --title "$TITLE" --author "$AUTHOR" --out "$OUT" --force)
if [ -n "$CATALOG" ]; then
  ARGS+=(--completion-catalog "$CATALOG")
else
  ARGS+=(--allow-without-completion-catalog)
fi
python3 "$ROOT/scripts/book_source_fetcher.py" "${ARGS[@]}"
