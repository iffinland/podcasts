#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
WORKSPACE_NAME="$(basename "$WORKSPACE_DIR")"
BACKUP_ROOT="$(cd "$WORKSPACE_DIR/.." && pwd)/_workspace_backups/$WORKSPACE_NAME"
MAX_BACKUPS=3

mkdir -p "$BACKUP_ROOT"

TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
BASE_NAME="${WORKSPACE_NAME}-${TIMESTAMP}"

if command -v zstd >/dev/null 2>&1; then
  ARCHIVE_PATH="$BACKUP_ROOT/${BASE_NAME}.tar.zst"
  tar --exclude='./node_modules' \
      --exclude='./dist' \
      --exclude='./dist-ssr' \
      --exclude='./.vite' \
      --exclude='./.DS_Store' \
      --exclude='./*.log' \
      --exclude='./coverage' \
      --exclude='./tmp' \
      --exclude='./temp' \
      --exclude='./.cache' \
      --exclude='./.turbo' \
      --exclude='./.next' \
      --exclude='./_workspace_backups' \
      -I 'zstd -19 -T0' \
      -cf "$ARCHIVE_PATH" \
      -C "$WORKSPACE_DIR" .
else
  ARCHIVE_PATH="$BACKUP_ROOT/${BASE_NAME}.tar.gz"
  tar --exclude='./node_modules' \
      --exclude='./dist' \
      --exclude='./dist-ssr' \
      --exclude='./.vite' \
      --exclude='./.DS_Store' \
      --exclude='./*.log' \
      --exclude='./coverage' \
      --exclude='./tmp' \
      --exclude='./temp' \
      --exclude='./.cache' \
      --exclude='./.turbo' \
      --exclude='./.next' \
      --exclude='./_workspace_backups' \
      -czf "$ARCHIVE_PATH" \
      -C "$WORKSPACE_DIR" .
fi

echo "Created backup: $ARCHIVE_PATH"

mapfile -t BACKUPS < <(find "$BACKUP_ROOT" -maxdepth 1 -type f \( -name '*.tar.zst' -o -name '*.tar.gz' \) -printf '%T@ %p\n' | sort -nr | awk '{print $2}')

if ((${#BACKUPS[@]} > MAX_BACKUPS)); then
  for OLD_BACKUP in "${BACKUPS[@]:MAX_BACKUPS}"; do
    rm -f "$OLD_BACKUP"
    echo "Removed old backup: $OLD_BACKUP"
  done
fi

echo "Kept latest $MAX_BACKUPS backups in: $BACKUP_ROOT"
