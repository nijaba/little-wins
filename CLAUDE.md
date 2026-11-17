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
- No personal data in the repository: no real names, hostnames, accounts or family details in code, docs, tests or commit messages. Personal deployment notes go in `*.local.md` files, which git ignores. One exception, approved by the owner: the repository's GitHub handle (`nijaba`) in repository and project-page links and `CODEOWNERS`.

## Commands

```bash
npm install                                     # dev tools (Biome); no runtime dependencies
npm test                                        # all tests (node --test)
npm run lint                                    # Biome lint + format check (CI runs it)
npm run test:coverage                           # API tests with coverage of the server (c8, thresholds)
npm run e2e:install && npm run test:e2e         # browser tests (Playwright, Chromium + WebKit)
SKIP_IMAGE_TESTS=1 npm test                     # skip the Docker image test (it needs Docker)
npm run format                                  # apply Biome formatting
npm run dev                                     # local server on :3000 with fake sign-in and demo families
scripts/build-site.sh                           # project page (site/ + pictures + video) into _site/
node scripts/icons.js                           # app icons (PNGs, favicon.ico) from public/icon*.svg
node scripts/guide-pictures.js                  # guide pictures (docs/images/) from a demo family
node scripts/tour-video.js                      # silent tour video (docs/video/tour.webm); then
~/.venvs/voice/bin/python scripts/tour-voiceover.py  # narrated public/tour.mp4 + poster (Kokoro, see the script)
docker compose up -d --build                    # container; real settings go in .env (see .env.example)
scripts/backup.sh                               # consistent backup of data/little-wins.db
```

## Layout

```
server/          index.js (wiring), config.js (env, startup check), db.js (migrations, starter list),
                 repo.js (family-scoped data layer: all SQL), auth.js (OAuth sign-in), fake-sso.js (dev/test only),
                 sessions.js, allowlist.js, ratelimit.js, routes.js, state.js, scoring.js (pure rules),
                 http.js (body limit, write guard, apiError), web.js (trusted proxies, HTTPS redirect, security headers),
                 demo.js (demo families: in-memory database, made-up history, idle sweep),
                 static.js (byte ranges for tour.mp4), messages.js (English server strings; keys are the API error codes), clock.js,
                 i18n/ (languages, Accept-Language, server-rendered pages and starter list per language)
public/          index.html (shell), app.js, strings.en.js (page strings, English base),
                 strings.<lang>.js (zh, es, fr, de; loaded on demand), style.css, manifest.json,
                 icon.svg, icon-maskable.svg and the icons made from them (scripts/icons.js),
                 tour.mp4 (narrated tour video, made by scripts/)
test/            *.test.js: real server on a temp database, signed in through the fake provider
                 (api, signin, setup, invites, children, pairing, time, startup, unclaimed),
                 edge (headers, proxies, rate limits), limits, export, operator, etag,
                 isolation.test.js (cross-family check for every parent route), demo (demo families, video),
                 site (the project page), family-invites (invite mode and the cap on families),
                 theme (light and dark contrast), icons (favicon and manifest icons), idle (idle families),
                 scoring.test.js (unit);
                 helpers.js (server, cookie jar, signIn, api, newFamily, pairChild, sql)
scripts/         backup.sh, build-site.sh, icons.js, guide-pictures.js, tour-video.js, tour-voiceover.py (dev only)
deploy/          caddy/ (dedicated host, automatic TLS) and nginx/ (behind an existing nginx)
docs/            design.md, build-plan.md, admin-guide.md, user-guide.md (for families), why.md (the story), test-plan.md,
                 security-review.md, legal/ (privacy and terms templates for hosted operators),
                 images/ (guide pictures), video/ (tour voice-over script, silent recording, poster)
site/            the project page (index.html, style.css), published to GitHub Pages by .github/workflows/pages.yml
```

## Rules that must always hold

- The child's view never shows penalties, warnings, notes, Settings or another child's data.
- The balance never goes below 0; entries apply in time order, each clamped at 0.
- Stars are recomputed from marks: a week wins a star with at least 2 perfect days and no bad day.
- Every user-entered string is escaped before it reaches the page.
- Session tokens are random and stored only as SHA-256 hashes.
- The app refuses to start with placeholder or weak secrets.
- The family comes from the session, never from the request. All SQL lives in `server/repo.js`; every function takes the family ID first and filters on it, and every ID in a request is used only together with that family ID. A new route needs a cross-family test.
- A child's device sees only its own child. Parents are matched on (provider, stable subject), never on email or display name.
- Writes are POST with a JSON body from the app's own origin.
- The fake sign-in provider only runs on localhost.

## How to work here

1. Read the matching part of `docs/design.md`. If the design is silent or wrong, ask; when the owner decides, update the design in the same change.
2. Write or update tests with the change, with an ID from `docs/test-plan.md` in the test name (add the row to the plan). Run `npm run lint`, `npm test` and, after page changes, `npm run test:e2e` before saying the work is done.
3. Never test against real data: tests use a temporary database.
4. The page runs under a strict Content Security Policy: no inline scripts, styles or event handlers. Use `data-action` attributes and the delegated listeners in `app.js`; set dynamic sizes through the DOM, not `style=` attributes.
