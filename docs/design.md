# Little Wins design

Little Wins is a points, stars and rewards tracker that a family uses on their phones. Parents record good behavior, the occasional penalty, and day-by-day marks on weekly challenges. Children see their points and stars grow toward rewards they've agreed on.

This document is the source of truth for how the app behaves. When code and this document disagree, one of them is a bug: fix the code, or update this document in the same change. `docs/build-plan.md` says what is built and in what order.

> **Current state.** The code today is a first, single-family version: two shared PINs, one child, no accounts, and the server's timezone. Sections marked **(target)** describe what the build plan adds. Everything else describes what the code does now.

## Principles

- **Positive first.** The child's view shows what they earned and what's next, never penalties, warnings or parents' notes.
- **Private by default.** Children's behavior data is sensitive. Collect as little as possible, send nothing to third parties, and make export and deletion easy.
- **Small and boring to run.** One container, one process, one SQLite file. No build step for the front end, and as few runtime dependencies as possible (none today).
- **Phone first.** Every screen works one-handed at 375 px wide.

## Firm constraints

Decided by the owner. Ask before trading one away.

- Node.js (22 or newer) on the server, using built-in `node:sqlite`. No external database, cache or queue.
- One container, one process. All state is in one SQLite file on a mounted volume.
- HTTPS only when deployed. `localhost` is the one exception.
- No analytics, trackers, ads, third-party scripts or third-party fonts, in either hosting mode.
- The same code serves both hosting modes; the difference is configuration.

## Hosting modes (target)

| | Self-hosted | Hosted |
|---|---|---|
| Who runs it | A family, on their own server | An operator, for many families |
| Families | One, created by the first allowed parent | Many, each created at sign-up |
| Who may create a family | `PARENT_ALLOWLIST` only (`SIGNUP_MODE=closed`) | Anyone who signs in (`SIGNUP_MODE=open`), or only people holding an invite (`SIGNUP_MODE=invite`) |
| Default limits | Generous | Enforced (see "Limits") |
| Legal pages | Not needed | Operator publishes a privacy policy and terms (`PRIVACY_URL`, `TERMS_URL`) |

The default is self-hosted, with sign-up closed. A hosted operator turns on the rest.

## Concepts

| Term | Meaning |
|---|---|
| Family | The tenant. Owns everything below; nothing is shared across families. |
| Parent | An adult with an account (Google or GitHub). One family's parents are its owner plus co-parents. |
| Owner | The parent who can delete the family or hand it to another parent. Exactly one per family. |
| Child | A profile with a first name or nickname. Never has an account. |
| Device | A logged-in browser: a parent's (from sign-in) or a child's (from pairing). |
| Behavior | Something that earns points: fixed (5) or a range (5–15). Called a "target" in code. |
| Penalty | Something that takes points away: a fixed amount. |
| Weekly challenge | A habit marked each day as perfect, OK or bad. |
| Reward | A milestone that needs a number of stars and/or points. |

## Behavior rules

These hold in both hosting modes. With several children **(target)**, each rule applies per child.

### Points

- A fixed behavior adds its points. A ranged behavior adds the amount the parent picks, clamped to the range; no amount means the minimum.
- A penalty subtracts its amount. A parent confirms before it's recorded.
- The balance never drops below 0. Entries apply in time order, and each one is clamped at 0, so a penalty on an empty balance costs nothing later.
- Undo removes an entry; the balance is recomputed from what remains.
- A parent may add a short note to an entry. Only parents see notes.

### Warnings

- A parent can give a warning on a behavior. Warnings count per behavior per day, shown as `n/2`. They carry no points.

### Weekly challenges and stars

- Weeks run Monday to Sunday **(target: per-family week start)**.
- A parent marks each challenge per day as perfect, OK or bad, by tapping the day to cycle through them. A new mark for a day replaces the old one.
- A challenge wins a star in a week with **at least 2 perfect days and no bad day**.
- Stars are counted over all weeks, and recomputed from marks every time, so fixing a mark changes the total.
- The Week tab browses past weeks back to the first week with entries, and always at least one week back, so last Sunday can be fixed on Monday morning. It never goes past the current week.
- Parents can mark any past day; future days are locked. Children browse read-only.

### Rewards

- A reward unlocks when the child has its stars and its points. Rewards are milestones: nothing is spent. **(Open question: redeeming rewards.)**
- The next reward not yet unlocked is shown as a progress ring.
- Each device shows a celebration the first time it sees a newly unlocked reward.

### What the child sees

- Today: their points, stars, the next reward, and the ways to earn points (no buttons).
- Week, Rewards, History: read-only. History shows only positive entries, without notes.
- Never: penalties, warnings, notes, Settings, or any other child's data **(target)**.

## Data model (target)

Every table except `users` has a `family_id`, and every query filters on it.

| Table | Columns (main ones) |
|---|---|
| `families` | id, name, timezone (IANA, e.g. `America/Chicago`), week_start, created |
| `users` | id, provider (`google`/`github`), subject (stable provider ID), email, login, display name, created, last_seen. Unique on (provider, subject). |
| `memberships` | family_id, user_id, role (`owner`/`parent`), created |
| `invites` | id, family_id, token_hash, role, created_by, expires, used_at |
| `children` | id, family_id, name, sort, created |
| `items` | id, family_id, kind (`target`/`penalty`/`challenge`), name, note, pmin, pmax, sort, active |
| `rewards` | id, family_id, name, stars, points, sort |
| `entries` | id, family_id, child_id, item_id, kind (`points`/`warn`/`mark`), points, day, ts, user_id, note, undone |
| `sessions` | id, token_hash, family_id, kind (`parent`/`child`), user_id or child_id, device, created, last_seen |
| `pairings` | id, family_id, child_id, token_hash, created_by, expires, used_at |

- Behaviors, penalties, challenges and rewards are one list per family, shared by its children. **(Open question: per-child lists.)**
- `day` is the calendar date in the family's timezone; `ts` is UTC.
- Deleting an item hides it; history keeps it. Deleting a child or a family deletes its rows.
- Schema changes are numbered migrations tracked with `PRAGMA user_version`, each in a transaction. WAL mode and `foreign_keys = ON`.

## Accounts and sign-in (target)

### Parents

- Sign in with Google or GitHub: OAuth 2.0 authorization code with PKCE. The state and code verifier travel in a signed cookie that lasts 10 minutes, so the server keeps no sign-in state.
- Google must report the email as verified. An account is matched on (provider, stable subject), never on email or display name.
- After sign-in:
  - A member of a family goes to it. (One family per parent in v1.)
  - Holding a valid invite, they join that family as a parent.
  - Otherwise, if `SIGNUP_MODE` lets them (open, or they're on `PARENT_ALLOWLIST`), a short setup creates a family: family name, timezone (from the browser), the first child's name, and the starter list or an empty one.
  - Anyone else sees "This Little Wins is private" and is signed out.
- `PARENT_ALLOWLIST` entries: `google:you@example.com` (verified email), `github:login`, `google-domain:example.com` (Workspace `hd` claim), `*` (anyone).
- **Co-parents** join by an invite link: single use, 7 days, created in Settings → Family. The owner can remove parents and hand ownership to another parent.

### Children's devices

- A parent picks a child in Settings → Devices and taps **Add a device**. The app shows a QR code and a link holding a random 128-bit token. The token is single use and expires after 10 minutes; only its hash is stored.
- Opening the link on the child's phone creates a child session bound to that one child.
- No child ever types a password or PIN.

### Sessions

- The cookie `lw_session` holds a random 256-bit token; the database stores its SHA-256 hash. HttpOnly, SameSite=Lax (OAuth returns by redirect), Secure outside `localhost`.
- Sessions unused for a year are deleted. Settings → Devices lists a family's sessions with device type, who, and last use; any can be logged out, including "this device".
- Signing out deletes the session.

### Development

- A fake sign-in provider runs only when `LITTLE_WINS_FAKE_SSO=1`, and the app refuses that setting unless `APP_BASE_URL` is `localhost`.

## Hosting for other families (target)

What changes when one installation serves many families, and how the design handles it.

### Isolation between families

- The family comes from the session, never from the URL or the request body.
- Every read and write goes through a data layer that takes the family ID as its first argument and adds `family_id = ?` to every statement. Every ID in a request is checked to belong to that family (`WHERE id = ? AND family_id = ?`). A miss is a 404, so IDs from other families look like IDs that don't exist.
- A child session reaches only its own child.
- The test suite has a cross-family test for every endpoint: family B can read, change and delete nothing of family A's.

### Sign-up and abuse

- Sign-up through Google or GitHub means no passwords to store, no email to send, and no bot sign-up form.
- `SIGNUP_MODE`: `closed` (default), `invite`, `open`.
- Rate limits per client IP (behind a trusted proxy): sign-in and pairing 10 a minute; writes 120 a minute; reads 600 a minute. 429 with `Retry-After` when exceeded.

### Limits

Defaults for hosted mode, each overridable by environment variable:

| Limit | Default |
|---|---|
| Children per family | 8 |
| Parents per family | 6 |
| Items per family | 200 |
| Rewards per family | 100 |
| Devices per family | 30 |
| Entries per family per day | 500 |
| Request body | 10 KB |

### Time zones and weeks

- Each family has an IANA timezone and a week start. "Today", day boundaries and weeks are computed in the family's timezone, never the server's.
- The browser's timezone is the default at family setup.

### Several children

- Points, stars, challenge marks and history are per child. Parents switch between children with a picker at the top; the Today tab acts on the selected child.
- A child's device shows only that child.

### Children's data and privacy

- **Minimal data.** A child is a first name or nickname. No birthdate, photo, school or contact details.
- **Children never provide data.** They have no account and can't type anything into the app.
- **Parents' notes** are visible to parents only and are excluded from the child's view and from logs.
- **No third parties.** No analytics, trackers or external fonts; the only third parties are the sign-in providers, which see only that someone signed in to this app.
- **Export and delete.** The owner can download the family's data as JSON, and delete the family. Deletion removes all its rows at once; backups age out within the stated retention period (30 days by default).
- **Logs** hold method, path template, status, duration and a truncated IP. Never names, notes or tokens. Kept 14 days.
- **Cookies** are strictly necessary (the session and the sign-in state), so no consent banner is needed.
- **Hosted operators** must publish a privacy policy and terms that cover parents as users, children's data processed on the parents' behalf, the hosting and sign-in providers as processors, and the retention periods. The app links to them from the sign-in page and Settings. This design is not legal advice: check GDPR (EU/UK) and COPPA (US) obligations for your situation.

### The operator

- `OPERATOR_ALLOWLIST` (same syntax as `PARENT_ALLOWLIST`) grants an operator page: counts of families, children and active devices, database size, version and health.
- Operators can't see any family's content through the app. Support access to a family needs a parent to grant it, for a limited time **(later)**.

### Performance

- One Node process with SQLite in WAL mode handles thousands of families with indexes on `(family_id, …)` for every table and `(family_id, child_id, day)` on entries.
- The state of one child is computed from that child's entries only. A per-family version number lets the 5-second refresh return `304 Not Modified` when nothing changed.

### Backups

- Nightly online backups (SQLite backup API) with an integrity check, kept 30 days, plus an off-site copy.
- In hosted mode, off-site copies are encrypted before they leave the server.
- Restoring is tested on a copy before relying on it.

## Security

These hold in both modes.

- **Configuration fails fast.** Outside `localhost`, the app refuses to start without an `https://` `APP_BASE_URL`, a `SESSION_SECRET` of at least 32 characters, at least one sign-in provider with both its client ID and secret, or with any fake provider turned on. Errors name the variable.
- **HTTPS.** Plain HTTP is redirected to `APP_BASE_URL`, never to the request's Host header. Forwarded headers are trusted only from `FORWARDED_ALLOW_IPS`.
- **Headers.** HSTS, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` with everything off, and a Content Security Policy of `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'`. The page therefore has no inline scripts, inline styles or inline event handlers.
- **Writes** must be JSON and come from the app's own `Origin`.
- **Output.** Every user-entered string is escaped before it reaches the page.
- **Requests.** Bodies over 10 KB are refused. Static files are served only from `public/` by plain file name.
- **Container.** Runs as a non-root user with a read-only root filesystem, no capabilities and `no-new-privileges`; the data volume is the only writable path. A `/healthz` endpoint backs the Docker healthcheck.
- **Dependencies.** Each runtime dependency needs a reason in this document. Dependabot, CodeQL, gitleaks and an image scan run in CI.

## Configuration (target)

| Variable | Meaning | Default |
|---|---|---|
| `APP_BASE_URL` | Public URL, `https://…` outside localhost | `http://localhost:3000` |
| `SESSION_SECRET` | Signs the sign-in state cookie; 32+ characters | Generated on localhost, required elsewhere |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google sign-in | Off |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | GitHub sign-in | Off |
| `SIGNUP_MODE` | `closed`, `invite` or `open` | `closed` |
| `PARENT_ALLOWLIST` | Who may create a family when sign-up is closed | Empty |
| `OPERATOR_ALLOWLIST` | Who sees the operator page | Empty |
| `PRIVACY_URL`, `TERMS_URL` | Legal pages, hosted mode | Empty |
| `DATABASE_PATH` | SQLite file | `/data/little-wins.db` |
| `FORWARDED_ALLOW_IPS` | Proxies trusted for client IP and scheme | Empty |
| `PORT` | Listening port | `3000` |
| `LIMIT_*` | Overrides for "Limits" | Mode defaults |
| `LITTLE_WINS_FAKE_SSO` | Fake sign-in, localhost only | Off |

Until phase 3 of the build plan, the app instead reads `PARENT_PIN`, `CHILD_PIN`, `SECRET` and `DB`.

## Front end

- One HTML page, one script and one stylesheet, served as static files with no build step.
- Bottom tabs with icons: Today, Week, Rewards, History, and Settings for parents.
- Settings sections fold; each header shows a count.
- The page polls the state every 5 seconds while visible, keeping the selected week.

## Open questions

Each has a working default; the owner decides.

| Question | Default until decided |
|---|---|
| Should rewards be redeemable (spend points, record it)? | No: milestones |
| Per-child behavior and reward lists? | One list per family |
| Can a child's device see siblings' progress? | No |
| Languages other than English? | English only; strings kept in one place |
| Passkeys as a sign-in option? | Later |
| Several families per parent? | One in v1 |
