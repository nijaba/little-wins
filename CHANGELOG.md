# Changelog

All notable changes are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). There are no tagged releases yet, so everything so far is under Unreleased. `package.json` says version 0.1.0.

## [Unreleased]

### Added in phase 6 (documentation and launch)

- User guide for families (`docs/user-guide.md`), with pictures from the demo family.
- Project page on GitHub Pages (`site/`, published by `.github/workflows/pages.yml`), with the tour video.
- Admin guide section on hosting for other families; privacy policy and terms templates for hosted operators (`docs/legal/`).
- `SECURITY.md`, `CONTRIBUTING.md`, this changelog, issue and pull request templates, `CODEOWNERS`.
- Security review (`docs/security-review.md`).

### Security

- A session unused for over a year ends when it is next used, not only when another session is created.
- Checked sign-in callbacks are rate limited (10 a minute per client), since each one calls the provider.
- Request timeouts: 15 seconds for headers, 30 for a whole request.

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
