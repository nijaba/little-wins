# Security review

A review of Little Wins' own code and configuration, done for phase 6 before launch, with what it found and what
was fixed. It is a code review against the design's security rules and common web risks, not a penetration
test of a running deployment. Report a new problem as [SECURITY.md](../SECURITY.md) says.

- **Version reviewed:** `main` after phase 5c, with the fixes below (phase 6).
- **Scope:** everything in `server/`, the page (`public/app.js`, `public/index.html`), the container
  (`Dockerfile`, `docker-compose.yml`, `deploy/`) and CI (`.github/workflows/`).
- **Out of scope:** a particular operator's server, reverse proxy and backups; the Google and GitHub sign-in
  services themselves; denial of service by sheer volume.

## What protects the app

What the review checked, and where each property is tested. Test IDs are in [test-plan.md](test-plan.md).

| Area | How it is protected | Tests |
|---|---|---|
| **Families kept apart** | The family comes from the session, never the request. All SQL is in `server/repo.js`; every function takes the family ID first and filters on it, and every ID in a request is checked against it. Another family's IDs answer 404, like IDs that don't exist. | IS-01 to IS-08 (every parent route, from a second family) |
| **Children's devices** | A child session sees one child, read-only: every write answers `viewOnly`. The child's state leaves out penalties, warnings, notes, Settings and siblings. | PA, CH, IS-04 |
| **Sign-in** | OAuth 2.0 code flow with PKCE (S256). The state, verifier and any invite ride in an HMAC-signed cookie that lasts 10 minutes, compared in constant time, bound to one provider. Google must report a verified email. Accounts are matched on (provider, stable subject), never email or name. | SI-04 to SI-26 |
| **Sessions** | 256-bit random tokens; only their SHA-256 is stored. Cookies are HttpOnly, SameSite=Lax (Strict for demos), Secure outside localhost. Removing a parent ends their sessions; every device can be logged out; sessions unused for a year end. | SI-01 to SI-03, SI-27, PA |
| **Cross-site requests** | Writes are POST with a JSON body (`Content-Type: application/json`, which a plain cross-site form can't send) and are refused with a foreign `Origin` or `Sec-Fetch-Site: cross-site`. | ED |
| **Injection** | SQL uses bound parameters only (`node:sqlite` prepared statements). The page escapes every user-entered string; the server's few HTML pages escape too. | E2E-20 (names render as text everywhere), SI-19 |
| **Content Security Policy** | `default-src 'self'`, no inline scripts, styles or handlers, `frame-ancestors 'none'`, `base-uri 'none'`. Plus nosniff, `X-Frame-Options: DENY`, a strict referrer policy, Permissions-Policy with everything off, COOP, and HSTS outside localhost. | ED |
| **Pairing and invite codes** | Pairing codes: 10 characters without look-alikes (about 50 bits), single use, 10 minutes, hashed. Invites: random, single use, 7 days, hashed. Both rate limited per client. | PA, FA |
| **Rate limits** | Per client IP: sign-in starts, checked sign-in callbacks, pairing, invite lookups and demo starts 10 a minute; API writes 120 and reads 600 a minute. Forwarded headers are believed only from `FORWARDED_ALLOW_IPS`, using the last `X-Forwarded-For` entry. | SI-25, SI-26, ED |
| **Requests** | Bodies over 10 KB are refused unread. Static files are served only from a list of plain file names made at startup, so no request builds a path. | LM, ED |
| **Startup check** | Outside localhost the app refuses to start without an `https://` base URL, a strong `SESSION_SECRET`, a complete provider, or with the fake sign-in on. | SV |
| **Demo families** | A separate in-memory database with its own sessions and cookie: a demo can never reach a real family, the database file, backups or exports. Account and device actions answer `demoOff`. | DM-01 to DM-13 |
| **Container** | Non-root user, read-only root filesystem, all capabilities dropped, `no-new-privileges`, one writable volume, a health check. | IM |
| **Supply chain** | No runtime dependencies. Dev tools and GitHub Actions pinned (actions by commit SHA) to releases at least two weeks old; Dependabot, CodeQL, gitleaks, `npm audit` and a Trivy image scan run in CI. Releases carry an SBOM and signed provenance. | CI |
| **Privacy** | No analytics, trackers, third-party scripts or fonts; only necessary cookies. The app writes no request log, and never logs names, notes or tokens. Export and deletion are in the app. | EX |

## Findings

| # | Finding | Severity | Status |
|---|---|---|---|
| 1 | A session unused for over a year kept working until the next sign-in anywhere on the server, because old sessions were only cleared when a new one was created. | Low | **Fixed:** checked on every use (SI-27) |
| 2 | The sign-in callback had no rate limit. Each checked callback makes the server call the provider's token endpoint, so one signed state cookie could be replayed for 10 minutes to make the server send requests. | Low | **Fixed:** limited to 10 a minute per client (SI-26) |
| 3 | The server kept Node's default request timeouts (5 minutes for a whole request), so slow clients could hold sockets open a long time. | Low | **Fixed:** 15 seconds for headers, 30 for the request. Checked by hand; a test would take a minute of waiting. |
| 4 | `PARENT_ALLOWLIST` entries `github:<login>` match the GitHub login, which an owner can rename and someone else can then register. That person could create a family on a closed installation. They could never reach an existing family: membership is matched on GitHub's numeric ID. | Low | **Accepted,** documented here. Prefer `google:` entries, or remove an entry once its family exists. |
| 5 | The session cookie is not named with the `__Host-` prefix, which would make browsers refuse it unless Secure, host-only and `Path=/`. The app already sets all three outside localhost. | Info | **Accepted:** renaming would sign every device out for little gain. Reconsider with any future cookie change. |
| 6 | Writes without both `Origin` and `Sec-Fetch-Site` are accepted. Modern browsers send at least one on cross-site requests, and the JSON content type already forces a CORS preflight that the app never grants. | Info | **Accepted** |
| 7 | The state cookie is not single use within its 10 minutes. The provider's code is single use, so a replay can't sign anyone in. | Info | **Accepted** (finding 2 limits the cost) |

### Design and code that disagree

Found during the review; none is a vulnerability. Each needs the owner's decision, so they are open items, not
fixes:

- The design says logs keep "method, path template, status, duration and a truncated IP" for 14 days. The app
  writes no request log at all. Request logs now come only from the reverse proxy, which the admin guide and
  the privacy template now cover.
- The design says backups are kept 30 days. `scripts/backup.sh` keeps 60 by default (`KEEP_DAYS`).
- The design says a parent may add a note to an entry. The API accepts one, but the page offers no way to add
  it, so in practice there are no notes.

## Next review

Review again before a change to sign-in, sessions, the data layer or the container, and at least once a year.
Keep this file's findings table up to date, and add each fix's test ID.
