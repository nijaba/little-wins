# Little Wins

A points, stars and rewards tracker for families, used on phones. Parents record behavior and weekly challenge marks; children see their progress toward rewards.

- `docs/design.md` is the source of truth for behavior. Read the relevant section before changing code.
- `docs/build-plan.md` lists the phases in order. Work on the current phase only, and tick boxes as items pass.
- `docs/admin-guide.md` covers deploying, updating, backups and troubleshooting.

## Firm constraints

Decided by the owner. Ask before trading one away.

- Node.js 22+ with built-in `node:sqlite`. No external database, cache or queue. Avoid runtime dependencies; each one needs a reason in design.md.
- One container, one process, one SQLite file on a mounted volume.
- HTTPS only when deployed; `localhost` is the one exception.
- No analytics, trackers, third-party scripts or third-party fonts.
- The same code serves self-hosted and hosted modes; the difference is configuration.
- No personal data in the repository: no real names, hostnames, accounts or family details in code, docs, tests or commit messages. Personal deployment notes go in `*.local.md` files, which git ignores.

## Commands

```bash
node --test                                     # all tests
ALLOW_DEFAULTS=1 DB=/tmp/lw.db node server.js   # local server on :3000, PINs 1234 (parent) and 0000 (child)
docker compose up -d --build                    # container; put real values in docker-compose.override.yml
scripts/backup.sh                               # consistent backup of data/little-wins.db
```

## Layout

```
server.js        HTTP server, SQLite, scoring, auth (to be split into modules in phase 2)
public/          index.html (page and script), manifest.json
test/            smoke.test.js: starts the server on a temp database and exercises the API
scripts/         backup.sh
docs/            design.md, build-plan.md, admin-guide.md
```

## Rules that must always hold

- The child's view never shows penalties, warnings, notes, Settings or another child's data.
- The balance never goes below 0; entries apply in time order, each clamped at 0.
- Stars are recomputed from marks: a week wins a star with at least 2 perfect days and no bad day.
- Every user-entered string is escaped before it reaches the page.
- Session tokens are random and stored only as SHA-256 hashes.
- The app refuses to start with placeholder or weak secrets.
- (From phase 3) The family comes from the session, never from the request. Every query filters on `family_id`, and every ID in a request is checked to belong to that family.

## How to work here

1. Read the matching part of `docs/design.md`. If the design is silent or wrong, ask; when the owner decides, update the design in the same change.
2. Write or update tests with the change. Run `node --test` before saying the work is done.
3. Never test against real data: tests use a temporary database.
