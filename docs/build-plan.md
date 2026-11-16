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
- [ ] Private GitHub repository created and pushed (made public at the end of phase 6)

## Phase 2: readable code and tooling

- [ ] `package.json` with `start`, `test`, `lint`, `format` scripts; Biome for lint and format
- [ ] Server split into modules: `config`, `db` (with numbered migrations via `PRAGMA user_version`), `auth`, `routes`, `scoring`, `static`
- [ ] Scoring rules as pure functions with unit tests
- [ ] Page split into `index.html`, `app.js`, `style.css`; no inline scripts, styles or event handlers (CSP-ready)
- [ ] User-facing strings kept in one place
- [ ] Make the weekly-challenge test independent of the day it runs (it skips on Mondays)

## Phase 3: families, children and real sign-in

- [ ] Data model from design.md: families, users, memberships, children, family-scoped items, rewards, entries and sessions; migration from the single-family schema
- [ ] Family-scoped data layer; a cross-family test for every endpoint
- [ ] Google and GitHub sign-in (OAuth code flow with PKCE); fake provider on localhost only
- [ ] `SIGNUP_MODE`, `PARENT_ALLOWLIST`; family setup (name, timezone, first child, starter list or empty)
- [ ] Co-parent invite links; owner can remove parents and hand over ownership
- [ ] Several children: per-child points, stars, marks and history; child picker for parents
- [ ] Device pairing for children (single-use link and QR, 10 minutes)
- [ ] Per-family timezone and week start
- [ ] PINs removed

## Phase 4: ready for the internet

- [ ] Fail-fast configuration (design.md, "Security"); `.env.example`
- [ ] HTTPS redirect to `APP_BASE_URL`, trusted proxies, security headers, strict CSP, Origin check on writes
- [ ] Rate limits and hosted-mode limits
- [ ] `/healthz`; non-root, read-only container with a healthcheck; pinned base image
- [ ] Deploy examples: Caddy (automatic TLS) and behind an existing nginx
- [ ] Data export (JSON) and family deletion
- [ ] Operator page
- [ ] `304 Not Modified` on unchanged state

## Phase 5: tests and CI

- [ ] `docs/test-plan.md` with an ID for every case; IDs in test names
- [ ] Playwright tests in WebKit and Chromium: phone sizes, escaping, tabs, folding, pairing, sign-in with the fake provider
- [ ] Docker image test; coverage report with a threshold
- [ ] GitHub Actions: lint, tests (Node 22 and 24), end-to-end, image build and healthcheck; docs-only fast path; least-privilege permissions; actions pinned by SHA
- [ ] Dependabot, CodeQL, gitleaks, image scan
- [ ] Tagged releases publish a multi-arch image to GHCR

## Phase 6: documentation and launch

- [ ] README with screenshots from demo data; user guide; admin guide for self-hosting and for hosted mode
- [ ] `SECURITY.md`, `CONTRIBUTING.md`, `CHANGELOG.md`, issue and PR templates, `CODEOWNERS`
- [ ] Privacy policy and terms templates for hosted operators
- [ ] Security review document, with fixes
- [ ] Repository made public
