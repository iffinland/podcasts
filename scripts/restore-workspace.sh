#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
WORKSPACE_NAME="$(basename "$WORKSPACE_DIR")"
BACKUP_ROOT="$(cd "$WORKSPACE_DIR/.." && pwd)/_workspace_backups/$WORKSPACE_NAME"
TARGET_DIR="${1:-$PWD}"

if [[ ! -d "$BACKUP_ROOT" ]]; then
  echo "Backup directory not found: $BACKUP_ROOT"
  exit 1
fi

mapfile -t BACKUPS < <(find "$BACKUP_ROOT" -maxdepth 1 -type f \( -name '*.tar.zst' -o -name '*.tar.gz' \) -printf '%T@ %p\n' | sort -nr | awk '{print $2}')

if ((${#BACKUPS[@]} == 0)); then
  echo "No backups found in: $BACKUP_ROOT"
  exit 1
fi

echo "Available backups:"
PS3="Choose backup to restore (number): "
select CHOSEN in "${BACKUPS[@]}"; do
  if [[ -n "${CHOSEN:-}" ]]; then
    break
  fi
  echo "Invalid selection. Try again."
done

mkdir -p "$TARGET_DIR"

if [[ -n "$(find "$TARGET_DIR" -mindepth 1 -maxdepth 1 -print -quit 2>/dev/null)" ]]; then
  read -r -p "Target directory '$TARGET_DIR' is not empty. Continue and overwrite files if needed? (y/N): " CONFIRM
  if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
    echo "Restore cancelled."
    exit 0
  fi
fi

case "$CHOSEN" in
  *.tar.zst)
    tar -I zstd -xf "$CHOSEN" -C "$TARGET_DIR"
    ;;
  *.tar.gz)
    tar -xzf "$CHOSEN" -C "$TARGET_DIR"
    ;;
  *)
    echo "Unsupported backup format: $CHOSEN"
    exit 1
    ;;
esac

echo "Restore completed into: $TARGET_DIR"
