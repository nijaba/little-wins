# Build plan

Little Wins is built in the phases below, in order. Finish a phase, with its tests passing and docs updated, before starting the next. `docs/design.md` says how each piece behaves.

Tick a box when the item is done and tested.

## Phase 1: a clean, generic project

- [x] Clean repository history
- [x] No child's name, family details, hostnames or accounts anywhere in the code or docs
- [x] Generic starter list of behaviors, penalties, challenges and rewards
- [x] The child's name is a parent setting (Settings → Child), stored in the database
- [x] Roles are `parent` and `child`; `CHILD_PIN` replaces the old variable
- [x] `docs/design.md`, including hosting for other families
- [x] `docs/admin-guide.md`, generic
- [x] `CLAUDE.md`, `README.md`, Apache-2.0 `LICENSE`, `.gitignore` with `*.local.md`, `.dockerignore`
- [x] Private GitHub repository created and pushed (made public at the end of phase 6)

## Phase 2: readable code and tooling

- [x] `package.json` with `start`, `test`, `lint`, `format` scripts; Biome for lint and format
- [x] Server split into modules: `config`, `db` (with numbered migrations via `PRAGMA user_version`), `auth`, `routes`, `scoring`, `static`
- [x] Scoring rules as pure functions with unit tests
- [x] Page split into `index.html`, `app.js`, `style.css`; no inline scripts, styles or event handlers (CSP-ready)
- [x] User-facing strings kept in one place (`server/messages.js`, `public/strings.js`)
- [x] Content Security Policy and `nosniff` headers on the page (early part of phase 4)
- [x] Serve `HEAD` requests for static files (done in phase 3)
- [x] Make the weekly-challenge test independent of the day it runs (it skips on Mondays)

## Phase 3: families, children and real sign-in

- [x] Data model from design.md: families, users, memberships, children, family-scoped items, rewards, entries and sessions; migration from the single-family schema
- [x] Family-scoped data layer; a cross-family test for every endpoint
- [x] Google and GitHub sign-in (OAuth code flow with PKCE); fake provider on localhost only
- [x] `SIGNUP_MODE` (`closed`, `open`), `PARENT_ALLOWLIST`; family setup (name, timezone, first child, starter list or empty)
- [ ] `SIGNUP_MODE=invite` with operator-issued family invites (behaves like `closed` until then; needs the operator page, phase 4)
- [x] Co-parent invite links; owner can remove parents and hand over ownership
- [x] Several children: per-child points, stars, marks and history; child picker for parents
- [x] Device pairing for children (single-use code and link, 10 minutes, rate limited; Share/Copy)
- [ ] QR code for pairing (needs a dependency or a hand-written encoder; see design.md)
- [x] Per-family timezone and week start
- [x] PINs removed
- [x] Writes must be JSON from the app's own origin (early part of phase 4)
- [x] Unclaimed (migrated) family is claimed only by an allowlisted parent

## Phase 4: ready for the internet

- [x] Fail-fast configuration (design.md, "Security"); `.env.example`
- [x] HTTPS redirect to `APP_BASE_URL`, trusted proxies, security headers, strict CSP, Origin check on writes
- [x] Rate limits and hosted-mode limits
- [x] `/healthz`; non-root, read-only container with a healthcheck; pinned base image
- [x] Deploy examples: Caddy (automatic TLS) and behind an existing nginx
- [x] Data export (JSON) and family deletion
- [x] Operator page
- [x] `304 Not Modified` on unchanged state
- [x] Pairing code refused for the device limit stays usable

## Phase 5: tests and CI

- [x] `docs/test-plan.md` with an ID for every case; IDs in test names
- [x] Playwright tests in WebKit and Chromium: phone sizes, escaping, tabs, folding, pairing, sign-in with the fake provider
- [x] Docker image test; coverage report with a threshold
- [x] GitHub Actions: lint, tests (Node 22 and 24), end-to-end, image build and healthcheck; docs-only fast path; least-privilege permissions; actions pinned by SHA
- [x] Dependabot, CodeQL, gitleaks, image scan
- [x] Tagged releases publish a multi-arch image to GHCR
- [x] Graceful shutdown on SIGTERM (container stop, coverage from server processes)
- [ ] First CI run on GitHub checked (workflows were reviewed by hand; actionlint couldn't run locally)
- [ ] Branch protection on `main` requiring the "CI passed" check

## Phase 5b: languages

- [ ] Translations of `public/strings.js` and `server/messages.js` into Chinese (Simplified), Spanish, French and German, alongside English
- [ ] Language chosen per family in Settings → Family (default: the browser's language at family setup); stored on the family
- [ ] Dates, day labels and numbers formatted with `Intl` in the family's language
- [ ] Sign-in, pairing and error pages follow the browser's language until a family is known
- [ ] Layout checked with longer (German) and CJK (Chinese) text at phone width; tests per language for the main screens
- [ ] Starter list translated, so a new family gets it in its own language

## Phase 5c: demo, tour and video (modeled on scrum-poker)

- [ ] Demo families (`DEMO_FAMILIES=1`, off by default): **Try a demo** on the sign-in page opens a private demo family with no sign-in, two children and a few weeks of made-up history (points, marks, stars, an unlocked reward). Switch between the parent's and the child's view. Clearly marked as a demo everywhere; never mixed with real families; deleted after an idle time and capped in number (`DEMO_MAX`, `DEMO_IDLE_SECONDS`), with a friendly message when full
- [ ] Guided tour drawn by the page alone (no library, nothing sent to the server): offered once per device (kept in `localStorage`), on demand from Settings, and every time in a demo; steps by role (parent: earning points, penalties, weekly marks, rewards, Settings, adding a child's device; child: points, stars, next reward); outlines the part it explains, Back/Next/Done, Escape closes, respects reduced motion
- [ ] Guide pictures and a 30-second narrated tour video, recorded with Playwright from the demo data (`scripts/guide-pictures.js`, `scripts/tour-video.js`, voiceover script in `docs/video/`); only made-up people and data; served at `/tour.mp4` with byte ranges (for Safari); **Watch the video** on the sign-in page (`TOUR_VIDEO=0` hides it)
- [ ] README "The tour in 30 seconds" with a poster image linking to the video

## Phase 6: documentation and launch

- [ ] README with screenshots from demo data; admin guide for self-hosting and for hosted mode
- [ ] `docs/user-guide.md` for families: getting started (sign in, set up, add children and a co-parent, pair a child's phone, add to the home screen), daily use (points, penalties, warnings, weekly marks, undo), rewards and stars explained, past weeks, Settings, what the child sees, tips for running a chart well; with screenshots from the demo data (phase 5c)
- [ ] Project page on GitHub Pages (`<owner>.github.io/little-wins`): what it is, screenshots, the tour video, self-host vs hosted, privacy stance, links to docs; built from `site/` by a Pages workflow, like scrum-poker; self-hosted fonts, no trackers
- [ ] `docs/why.md`: why Little Wins exists, the story behind it, linked from the README
- [ ] `SECURITY.md`, `CONTRIBUTING.md`, `CHANGELOG.md`, issue and PR templates, `CODEOWNERS`
- [ ] Privacy policy and terms templates for hosted operators
- [ ] Security review document, with fixes
- [ ] Repository made public
- [ ] Launch announcement (blog post), linked from the README and the project page
