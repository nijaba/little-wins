#!/bin/sh
# Nightly backup of data/little-wins.db. Safe to run while the app is up:
# it uses SQLite's online backup (a consistent copy), checks it, then
# deletes copies older than KEEP_DAYS. Needs only python3 on the host.
#
#   scripts/backup.sh                     # -> ~/little-wins-backup/daily/little-wins-YYYY-MM-DD.db
#   BACKUP_DIR=/x KEEP_DAYS=30 scripts/backup.sh
set -eu
APP_DIR=$(cd "$(dirname "$0")/.." && pwd)
SRC=${DB_FILE:-$APP_DIR/data/little-wins.db}
DEST=${BACKUP_DIR:-$HOME/little-wins-backup/daily}
KEEP=${KEEP_DAYS:-60}
OUT="$DEST/little-wins-$(date +%F).db"

mkdir -p "$DEST"
trap 'rm -f "$OUT.tmp"' EXIT
rm -f "$OUT.tmp"

python3 -I - "$SRC" "$OUT.tmp" <<'PY'
import sqlite3, sys
src = sqlite3.connect(f"file:{sys.argv[1]}?mode=ro", uri=True)
dst = sqlite3.connect(sys.argv[2])
src.backup(dst)
check = dst.execute("PRAGMA integrity_check").fetchone()[0]
entries = dst.execute("SELECT COUNT(*) FROM entries").fetchone()[0]
dst.close(); src.close()
if check != "ok":
    sys.exit(f"integrity check failed: {check}")
print(f"{entries} entries", end=" ")
PY

mv "$OUT.tmp" "$OUT"
find "$DEST" -name 'little-wins-*.db' -mtime +"$KEEP" -delete
echo "backup ok: $OUT ($(date '+%F %T %Z'))"
