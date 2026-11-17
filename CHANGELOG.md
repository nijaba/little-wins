# Changelog

All notable changes are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). There are no tagged releases yet, so everything so far is under Unreleased. `package.json` says version 0.1.0.

## [Unreleased]

### Added in phase 6 (documentation and launch)

- Why Little Wins? (`docs/why.md`): the story behind it, linked from the README, the user guide and the project page.
- User guide for families (`docs/user-guide.md`), with pictures from the demo family.
- Project page on GitHub Pages (`site/`, published by `.github/workflows/pages.yml`), with the tour video.
- Admin guide section on hosting for other families; privacy policy and terms templates for hosted operators (`docs/legal/`).
- `SECURITY.md`, `CONTRIBUTING.md`, this changelog, issue and pull request templates, `CODEOWNERS`.
- Security review (`docs/security-review.md`).

### Added for hosting

- Encrypted off-site backups: with `BACKUP_PUBLIC_KEY`, `scripts/backup.sh` also writes a copy only the operator's private key can read (`server/backup-crypto.js`, no dependency).
- Idle families are deleted after `DELETE_IDLE_FAMILIES_DAYS` without use (default 365, `0` turns it off); parents see the rule in Settings.
- Family invites from the operator page (`SIGNUP_MODE=invite`): single-use links that last 30 days, listed and cancellable.
- `LIMIT_FAMILIES` caps how many families an installation holds; past it, new parents see a calm "full for now" screen.
- `SIGNUP_CONTACT_URL` adds "Ask for a place" to the private and full screens.

### Changed

- The project page's header twinkles with the app's gold stars and warm glow, and shows the app's icon.
- The app's footer links to the project page; the project page and README link to the demo and the hosted service.
- History grouped by day, with each day's points and its best moment on top.
- Friendly touches: a greeting and today's points on the child's Today, "N more ★ to go!" on every locked reward with a sparkle on unlocked ones, and kind words where a list is empty.
- Stars to collect on the child's screens: perfect days as gold stickers, a "⭐ won!" stamp on weeks that win, and a star jar on Rewards.
- Celebrations: the child's points count up when new ones arrived, confetti when a reward unlocks, a glowing ring near the end, and "+5" floating up from the + button. Still with reduced motion.
- Emoji for behaviors, penalties, challenges, rewards and children, picked in the edit form and shown on every screen; the starter list comes with them. The page's files are revalidated on each load (`Cache-Control: no-cache`), so updates show right away.
- A brighter sign-in page: the star logo, a tagline, three reasons to use Little Wins and a few twinkling stars, with Try a demo in gold.
- Notices on a child's device: once a parent allows them for that child, a reward unlocked or a milestone reached sends a Web Push to the child's device, once each.
- Evening reminder, opt-in per parent phone: one Web Push a day at the chosen time when a challenge is still unmarked (encrypted, no dependency; `PUSH_REMINDERS=0` turns it off).
- Behaviors, penalties, challenges and rewards can be for some children only ("Who is it for?" in the edit form); each child's Today, Week and Rewards show only theirs.
- Encouragement: a parent's message on the child's Today (a week, or until changed), and milestones the app spots (perfect days in a row, best week so far).
- Weekly review for parents, at the bottom of the Week tab: the week's stars, points, warnings and challenges, the last four weeks, and a Print button for a counselor or teacher.
- An app icon: a gold star on navy, as the favicon, the iOS and Android home-screen icons (with a maskable one) and on the project page.
- Dark mode: the page follows the device's light or dark setting. Colors are theme tokens, and every text color passes WCAG AA contrast in both themes. In light mode, gray buttons are darker and warning buttons have dark text, for contrast.
- Parents can add a note to points, a penalty or a warning, from the confirmation message or History (parents only).
- `scripts/backup.sh` keeps copies 30 days by default (was 60), as the design and privacy template say.
- The design now says the app writes no request log (it never did).

### Security

- A session unused for over a year ends when it is next used, not only when another session is created.
- Checked sign-in callbacks are rate limited (10 a minute per client), since each one calls the provider.
- Request timeouts: 15 seconds for headers, 30 for a whole request.
- Dev tools only: npm `overrides` pin minimatch 11.0.3 and glob 14.0.3 under c8's test-exclude, for two moderate advisories (minimatch pattern DoS, glob AbortSignal bypass), until test-exclude moves to them. Remove the overrides then.

### Added

- Phase 1, a clean generic project: generic starter list, the child's name as a parent setting, `parent` and `child` roles, design document, admin guide, Apache-2.0 license.
- Phase 2, readable code and tooling: Biome, server split into modules with numbered migrations, pure scoring rules with unit tests, a page with no inline scripts or styles.
- Phase 3, families and sign-in: families, children and co-parents; Google and GitHub sign-in (OAuth code flow with PKCE); `SIGNUP_MODE` and `PARENT_ALLOWLIST`; invite links; several children with their own points, stars and marks; device pairing for a child's phone; family-scoped data layer with a cross-family test for every route.
- Phase 4, ready for the internet: fail-fast configuration, HTTPS redirect, trusted proxies, security headers and a strict Content Security Policy, Origin check on writes, rate limits, `/healthz`, non-root read-only container, Caddy and nginx deploy examples, data export and family deletion, operator page.
- Phase 5, tests and CI: test plan with an ID for every case, browser tests in Chromium and WebKit, Docker image test, coverage thresholds, GitHub Actions, Dependabot, CodeQL, gitleaks, image scan, branch protection on `main`, multi-arch image releases to GHCR.
- Phase 5b, languages: English, Chinese (Simplified), Spanish, French and German for the page, server pages and error codes; the language is set per family.
- Phase 5c, demo, tour and video: demo families, a guided tour drawn by the page, guide pictures and a narrated 30-second tour video.

### Fixed

- Static files are served from an allowlist and device codes look uniform (CodeQL findings).
- Radio buttons keep their natural width.
- A lone button on a line wraps, so German text fits 360 px.
