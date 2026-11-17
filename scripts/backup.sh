#!/bin/sh
# Nightly backup of data/little-wins.db. Safe to run while the app is up:
# it uses SQLite's online backup (a consistent copy), checks it, then
# deletes copies older than KEEP_DAYS. Needs only python3 on the host.
#
# With BACKUP_PUBLIC_KEY (an "lwpub1-..." key from `node server/backup-crypto.js keygen`), it
# also writes an encrypted copy to OFFSITE_DIR for another machine to pull: only the private
# key, kept off this server, can read it. The encryption runs with Node 22+ on the host, or in
# the running container when the host has none.
#
#   scripts/backup.sh                     # -> ~/little-wins-backup/daily/little-wins-YYYY-MM-DD.db
#   BACKUP_DIR=/x KEEP_DAYS=14 scripts/backup.sh   # copies are kept 30 days by default
set -eu
APP_DIR=$(cd "$(dirname "$0")/.." && pwd)
SRC=${DB_FILE:-$APP_DIR/data/little-wins.db}
DEST=${BACKUP_DIR:-$HOME/little-wins-backup/daily}
KEEP=${KEEP_DAYS:-30}
OUT="$DEST/little-wins-$(date +%F).db"

mkdir -p "$DEST"
OFFSITE=${OFFSITE_DIR:-$HOME/little-wins-backup/offsite}
ENC="$OFFSITE/little-wins-$(date +%F).db.lwb"
trap 'rm -f "$OUT.tmp" "$ENC.tmp"' EXIT
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

if [ -n "${BACKUP_PUBLIC_KEY:-}" ]; then
  mkdir -p "$OFFSITE"
  if command -v node >/dev/null 2>&1 &&
    node -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 22 ? 0 : 1)'; then
    node "$APP_DIR/server/backup-crypto.js" encrypt "$BACKUP_PUBLIC_KEY" <"$OUT" >"$ENC.tmp"
  else
    (cd "$APP_DIR" && docker compose exec -T little-wins node server/backup-crypto.js encrypt "$BACKUP_PUBLIC_KEY") <"$OUT" >"$ENC.tmp"
  fi
  mv "$ENC.tmp" "$ENC"
  find "$OFFSITE" -name 'little-wins-*.db.lwb' -mtime +"$KEEP" -delete
  echo "encrypted copy: $ENC"
fi
