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
- [x] `SIGNUP_MODE=invite` with operator-issued family invites, plus `LIMIT_FAMILIES` and `SIGNUP_CONTACT_URL` (owner's decisions, 2026-11-17: both, 30-day single-use links, a calm note with a contact link)
- [x] Co-parent invite links; owner can remove parents and hand over ownership
- [x] Several children: per-child points, stars, marks and history; child picker for parents
- [x] Device pairing for children (single-use code and link, 10 minutes, rate limited; Share/Copy)
- ~~QR code for pairing~~: dropped by the owner (2026-11-17). Sharing the link or typing the code is enough, and it would need a dependency or a hand-written encoder.
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
- [x] First CI run on GitHub checked: it caught npm CVEs in the image, a literal test secret and a slow browser test, all fixed
- [x] Branch protection on `main` requiring the "CI passed" check (`.github/rulesets/main.json`, applied once the repository went public)

## Phase 5b: languages

- [x] Translations of the page strings (`public/strings.<lang>.js`), the server's own pages and API error codes (`server/i18n`, `code` on every error) into Chinese (Simplified), Spanish, French and German, alongside English
- [x] Language chosen per family in Settings → Family (default: the browser's language at family setup); stored on the family
- [x] Dates, day labels and numbers formatted with `Intl` in the family's language
- [x] Sign-in, pairing and error pages follow the browser's language until a family is known
- [x] Layout checked with longer (German) and CJK (Chinese) text at phone width; tests per language for the main screens
- [x] Starter list translated, so a new family gets it in its own language

## Phase 5c: demo, tour and video (modeled on scrum-poker)

Design: "Demo families", "Tour" and "Guide pictures and the tour video". Decided by the owner on 2026-11-16: demo families in a second SQLite database held in memory; the voice-over made with Kokoro, like scrum-poker; the README poster links to a placeholder address until there is a public installation.

- [x] Demo families (`DEMO_FAMILIES=1`, off by default): **Try a demo** on the sign-in page opens a private demo family with no sign-in, two children and a few weeks of made-up history (points, marks, stars, an unlocked reward). Switch between the parent's and the child's view. Clearly marked as a demo everywhere; never mixed with real families; deleted after an idle time and capped in number (`DEMO_MAX`, `DEMO_IDLE_SECONDS`), with a friendly message when full
- [x] Guided tour drawn by the page alone (no library, nothing sent to the server): offered once per device (kept in `localStorage`), on demand from Settings, and every time in a demo; steps by role (parent: earning points, penalties, weekly marks, rewards, Settings, adding a child's device; child: points, stars, next reward); outlines the part it explains, Back/Next/Done, Escape closes, respects reduced motion
- [x] Guide pictures and a 30-second narrated tour video, recorded with Playwright from the demo data (`scripts/guide-pictures.js`, `scripts/tour-video.js`, voiceover script in `docs/video/`); only made-up people and data; served at `/tour.mp4` with byte ranges (for Safari); **Watch the video** on the sign-in page (`TOUR_VIDEO=0` hides it)
- [x] README "The tour in 30 seconds" with a poster image linking to the video

## Phase 6: documentation and launch

- [x] README with screenshots from demo data; admin guide for self-hosting and for hosted mode
- [x] `docs/user-guide.md` for families: getting started (sign in, set up, add children and a co-parent, pair a child's phone, add to the home screen), daily use (points, penalties, warnings, weekly marks, undo), rewards and stars explained, past weeks, Settings, what the child sees, tips for running a chart well; with screenshots from the demo data (phase 5c)
- [x] Project page on GitHub Pages (`<owner>.github.io/little-wins`): what it is, screenshots, the tour video, self-host vs hosted, privacy stance, links to docs; built from `site/` by a Pages workflow, like scrum-poker; self-hosted fonts, no trackers
- [x] `docs/why.md`: why Little Wins exists, the story behind it, linked from the README
- [x] `SECURITY.md`, `CONTRIBUTING.md`, `CHANGELOG.md`, issue and PR templates, `CODEOWNERS`
- [x] Privacy policy and terms templates for hosted operators
- [x] Security review document, with fixes
- [x] Repository made public (early, before the rest of phase 6, to enable branch protection and CodeQL)
- [x] Apply `.github/rulesets/main.json` (branch protection) right after the repository goes public
- [x] App icon: favicon, home-screen icons and manifest icons, also on the project page
- Launch announcement: moved to Later by the owner (2026-11-17)

## Phase 7: families in the long run

Proposed after launch prep and accepted by the owner (2026-11-17). Defaults are the owner's where they answered, otherwise the proposal's, written into design.md.

- [x] Idle families deleted after `DELETE_IDLE_FAMILIES_DAYS` (default 365, `0` turns it off); Settings states the rule (an in-app warning would never be seen: opening the app keeps the family) (owner: operator sets it, on by default)
- [x] Encrypted off-site backups: a script that encrypts each nightly copy before it leaves the server
- [x] A weekly review page for parents, printable for a counselor or teacher
- [x] Encouragement: a parent's short message on the child's Today, and milestones the app spots (streaks, best week)
- [x] Behaviors, challenges and rewards limited to some children (one family list; each item can say who it is for)
- [x] Notices on a child's device when they unlock a reward or reach a milestone, allowed per child by a parent (owner's request, 2026-11-17)
- [x] An evening reminder to mark the day, for parents who turn it on (Web Push, no dependency)

## Priority 1: running the hosted service

The owner's priorities for the hosted service (2026-11-17), before phase 8. Deployment details stay in the git-ignored
`deploy.local.md`, not here.

- [x] Encrypted off-site backups for the hosted service: a backup key kept off the server, `BACKUP_PUBLIC_KEY` on the
  nightly job, and the `offsite` folder copied to another machine (see the admin guide, "Encrypted copies for off-site")
- [x] "Ask for a place" on the hosted service: `SIGNUP_CONTACT_URL` set, so families who find it full or private know
  whom to ask

## Phase 8 (priority 2): a more fun app

Proposed and accepted by the owner (2026-11-17), after the brighter sign-in page. The fun goes to the child's screens;
the parents' recording and Settings stay quick and calm. Everything stays positive-only, with no dependency, under the
strict CSP, in light and dark mode, and still with reduced motion. Each item gets its design in design.md first.

- [x] An emoji for each behavior, reward and child, picked by a parent (a short picker, no library), shown large in the
  lists, on reward cards and in the child's header, with defaults for the starter list; helps children who can't read
  well yet
- [x] Celebrations: the child's points count up when new ones arrived since they last looked; a reward unlock with CSS
  confetti and a bounce; a full ring glows; a small "+5" floats up from the + button
- [x] Stars to collect: a perfect day as a tilted gold sticker on the child's Week, a "⭐ won!" stamp on a week that wins,
  and the stars so far filling a jar or row toward the next reward
- [ ] A greeting on the child's Today by time of day ("Good morning, Mia! ☀️")
- [ ] Reward cards as goals: progress bars and "3 more ★ to go!" on locked rewards, a sparkle badge on unlocked ones
- [ ] Friendlier empty moments ("No points yet today — let's go!")
- [ ] History grouped by day, with each day's total and its best moment on top

## Later (not yet scheduled)

- [ ] Launch announcement (blog post), linked from the README and the project page; a draft for parents is in the
  owner's git-ignored notes, waiting for the go-ahead (moved from phase 6, 2026-11-17)
- [x] Dark and light mode: follow the device's setting (`prefers-color-scheme`), with colors as CSS variables; check contrast in both, including the progress ring, marks and buttons
