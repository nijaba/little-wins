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
| Legal pages | Not needed | Operator publishes a privacy policy and terms (`PRIVACY_URL`, `TERMS_URL`), starting from the templates in `docs/legal/` |

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
- A parent may add a short note (up to 120 characters) to points, a penalty or a warning: **Note** on the confirmation message right after recording it, or **note** beside the entry in History, opens a prompt with the current note. An empty note removes it. A mark has no note. Only parents see notes.

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

### Encouragement

- **A parent's message.** A parent writes a short message to a child (up to 140 characters) from the top of Today: **Write <child> a message**, then **Change** or **Clear**. It shows at the top of the child's Today, signed with the parent's name, until it is replaced or cleared, and for 7 days at most (owner's default). One message per child (`messages` table, migration 7; it goes with the child and is in the export). It is meant to be read by the child, unlike notes on entries, which children never see.
- **Milestones** the app spots by itself, positive only, on Today for both views: **N perfect days in a row** (3 or more days, up to today or yesterday, with at least one perfect mark each) and **Best week so far** (this week's points earned beat every earlier week's, from the third week with points). Nothing is stored: they are worked out from the entries each time.
- The demo family has a message from its parent to the first child.

### Evening reminders

- **Opt-in, per device.** A parent turns it on for one phone in Settings → **Evening reminder**, with a time (default 19:30, in the family's time zone). It is off until then, a child's device is never offered it, and a demo can't use it. `PUSH_REMINDERS=0` turns the feature off for the installation.
- **Once a day, only when needed.** From its time until two hours later (so a server that was down doesn't wake anyone at midnight), the server sends one reminder if some child still has a challenge meant for them without a mark today. The text is the same for every family in its language ("Time to mark today's challenges."): nothing about any child.
- **Web Push with no dependency** (`server/webpush.js`): the message is encrypted for the device (RFC 8291, aes128gcm) and the request signed with the installation's VAPID key (RFC 8292). The VAPID keys are made on first use and kept in the database (`app_settings`). Subscriptions (`push_subscriptions`, one per parent session, migration 9) go when the device is logged out; one the push service calls gone (404, 410) is deleted.
- **The exception.** Web Push always goes through the browser maker's push service (Apple, Google or Mozilla). It can't read the message, but it sees that this server sent the device a reminder, and when. The owner allowed this as an exception to "no third parties" because it is opt-in per device and carries nothing about the child. The Settings section says so, and the privacy template names the push services.
- **No open relay.** A subscription's endpoint must be an `https` URL on a known push service (FCM, Mozilla, Apple, Windows), so a client can't make the server send requests elsewhere.
- `public/sw.js`, the service worker, only shows the reminder and opens the app when it is tapped; it caches nothing.

### Notices on a child's device

- **Allowed per child, turned on on the device.** A parent allows notices for a child in Settings → Children (**🔔 Notices on their device**, off by default; `children.notify`). That child's device then shows a one-time **Turn on notifications** card on Today; tapping it asks the device for permission and subscribes it (`kind='child'` in `push_subscriptions`, migration 10). Children still type nothing. Stopping notices removes their devices' subscriptions. Off in demos.
- **What is sent.** Right after a parent's action (points, a mark) newly unlocks a reward meant for that child, completes a streak of 3 or more perfect days, or makes this week the best so far: "⭐ You unlocked <reward>!", "🔥 N perfect days in a row!", "🏅 Your best week so far!", in the family's language. Only good news: penalties and warnings never send anything.
- **Once each.** Every notice has a key (the reward, the streak's first day, the week) recorded in `child_notices`, so undoing and redoing an entry doesn't send it again.
- **The wider exception** (owner's decision, 2026-11-17). Unlike the parents' reminder, a child notice names the reward or milestone. The text is encrypted for the device, so the push service still sees only that the child's device got a notice, and when. Child subscriptions never get the evening reminder.

### Weekly review

- Parents open **Weekly review** at the bottom of the Week tab: one child, one week (the week shown, browsable like the Week tab).
- It shows stars won, points earned and points lost to penalties (the entries' own amounts, before the balance's floor at 0), warnings, perfect and bad days; points by day as bars; each challenge's marks; the five behaviors done most often; warnings by behavior; and the last four weeks side by side.
- **Print** prints it (or saves a PDF), for a counselor or a teacher, with no account for them: print styles use the light colors and hide buttons and tabs. It is computed by `GET /api/review?child=&week=` (parents only, one child of the session's family; read-only) from the same entries as everything else.

### What the child sees

- Today: their points, stars, the next reward, and the ways to earn points (no buttons).
- Week, Rewards, History: read-only. History shows only positive entries, without notes.
- Never: penalties, warnings, notes, Settings, or any other child's data **(target)**.

## Data model (target)

Every table except `users` and `family_invites` has a `family_id`, and every query filters on it.

| Table | Columns (main ones) |
|---|---|
| `families` | id, name, timezone (IANA, e.g. `America/Chicago`), week_start, language (`en`, `zh`, `es`, `fr`, `de`; phase 5b), created, last_active (any device's latest use) |
| `users` | id, provider (`google`/`github`), subject (stable provider ID), email, login, display name, created, last_seen. Unique on (provider, subject). |
| `memberships` | family_id, user_id, role (`owner`/`parent`), created |
| `invites` | id, family_id, token_hash, role, created_by, expires, used_at |
| `family_invites` | id, token_hash, created_by, created, expires, used_by, used_at, family_id (set when the invited parent's family is created). Installation-wide, not family-scoped: only the operator page reaches it. |
| `children` | id, family_id, name, sort, created, notify (notices on their device allowed) |
| `items` | id, family_id, kind (`target`/`penalty`/`challenge`), name, note, pmin, pmax, sort, active, for_all |
| `push_subscriptions` | session_id, family_id, endpoint, p256dh, auth, time (HH:MM), last_day, kind (`parent`: evening reminder; `child`: notices), created |
| `app_settings` | key, value: installation-wide values (the VAPID keys) |
| `child_notices` | child_id, family_id, key, sent: notices already sent to a child's devices (each once) |
| `item_children`, `reward_children` | item_id or reward_id, child_id, family_id: who a limited item or reward is for |
| `rewards` | id, family_id, name, stars, points, sort, for_all |
| `entries` | id, family_id, child_id, item_id, kind (`points`/`warn`/`mark`), points, day, ts, user_id, note, undone |
| `sessions` | id, token_hash, family_id, kind (`parent`/`child`), user_id or child_id, device, created, last_seen |
| `pairings` | id, family_id, child_id, token_hash, created_by, expires, used_at |

- Behaviors, penalties, challenges and rewards are one list per family. Each one is **for everyone** (`for_all=1`, the default) or **for some children** (`for_all=0`, the children named in `item_children` / `reward_children`; migration 8). The edit form, with two or more children, asks "Who is it for?": every child ticked means everyone, including children added later. If the only children an item was for are deleted, it is for nobody until edited, never suddenly for everyone.
- Today, Week, Rewards (and the ring), the weekly review and the stars' challenges show what is for the chosen child. Settings lists everything, with "For: Mia" under the limited ones. Recording an item for a child it is not for is refused (`400`). A child's device receives only what is for that child. IDs of another family's children are dropped when saving.
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
- **Co-parents** join by an invite link: single use, 7 days, created in Settings → Parents. Opening it shows "Sign in to join <family>"; the invite rides through sign-in inside the signed state cookie.
- The owner can remove parents and hand ownership to another parent, after a confirmation. The old owner stays as a parent. (No offer-and-accept step: both are trusted members of the same family.)
- **A family with no parents** (for example after migrating data from an older single-family install) is claimed by the first parent who signs in and is allowed to create a family. They become its owner instead of creating a new family.

### Children's devices

- A parent picks a child in Settings → Devices and taps **Add a device**. The app shows a one-time code of 10 characters, grouped for reading (`KD7Q-M3XA-PJ`, about 50 bits, no look-alike characters), and a link holding it (`/#pair=…`) with **Share** and **Copy** buttons. The code is single use and expires after 10 minutes; only its hash is stored.
- On the child's phone, opening the link, or typing the code under "Use a code from a parent" on the sign-in screen, creates a child session bound to that one child.
- Redeeming codes is rate limited per client. With 50 bits and a 10-minute life, guessing one is not practical.
- No child ever types a password. Pairing is by sharing the link or typing the code; there is no QR code (the owner decided against it: it would need a dependency or a hand-written encoder for little gain).

### Sessions

- The cookie `lw_session` holds a random 256-bit token; the database stores its SHA-256 hash. HttpOnly, SameSite=Lax (the sign-in provider returns by redirect, which a Strict cookie would not survive), Secure outside `localhost`. Because Lax cookies ride along on top-level navigations from other sites, every write must also be JSON from the app's own `Origin` (see "Security").
- Sessions unused for a year end: one is refused and deleted when it is next used, and the rest are cleared whenever a session is created. Settings → Devices lists a family's sessions with device type, who, and last use; any can be logged out, including "this device".
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
- **Family invites** (`SIGNUP_MODE=invite`). An operator creates a link on the operator page (**Invite a family**) and sends it to a family any way they like. It works once, for 30 days, and only its SHA-256 is stored. Opening it (`/#signup=…`) says "You're invited to start a family" and offers sign-in; the token rides through sign-in inside the signed state cookie, like a co-parent invite. A parent who signs in with a valid invite and has no family uses it up and goes to setup; the invite then belongs to them until their family is created, so they can finish setup later, from another device too. Open invites are listed on the operator page, with **Cancel**. Without a valid invite, a new parent sees the private page. `PARENT_ALLOWLIST` still works in invite mode.
- **A cap on families** (`LIMIT_FAMILIES`, optional, in every mode). When the installation holds that many families (demo families never count), a new parent without a family sees "This Little Wins is full for now" instead of setup, and setup is refused (`409`, `serviceFull`). Joining an existing family as a co-parent still works. An invite that meets a full installation is not used up. The operator page shows the families against the cap.
- **Who to ask.** `SIGNUP_CONTACT_URL` (optional, `https://` or `mailto:`) adds "Ask for a place" to the private and full pages, so a family knows whom to ask. The app itself collects no email and has no waiting list.
- Rate limits per client IP (behind a trusted proxy): sign-in starts, checked sign-in callbacks (each one calls the provider) and pairing 10 a minute; writes 120 a minute; reads 600 a minute. 429 with `Retry-After` when exceeded.

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
- **No third parties.** No analytics, trackers or external fonts; the only third parties are the sign-in providers, which see only that someone signed in to this app, and, for a parent who turns on the evening reminder on a device, that device's push service (see "Evening reminders"). The push exception was the owner's decision (2026-11-17), widened the same day to notices on a child's device that a parent allowed (see "Notices on a child's device").
- **Idle families** (`DELETE_IDLE_FAMILIES_DAYS`, default 365; `0` turns it off; owner's decision: the operator sets it, on by default). A family that no device, parent's or child's, has used for that many days is deleted with everything it owns, like a family deleted by its owner; its parents' accounts go too unless they belong to another family. Each family keeps `last_active`, updated when any of its devices uses the app (at most every 5 minutes). The server sweeps at startup and every 6 hours and logs only the count. Families without parents (unclaimed, migrated data) are kept for their owner. Settings → Family tells parents the rule. There is no warning before deletion: opening the app is what keeps a family, so a warning shown in the app would never be needed, and the app has no email to send one. The operator page shows the setting.
- **Export and delete.** The owner can download the family's data as JSON, and delete the family. Deletion removes all its rows at once; backups age out within the stated retention period (30 days by default).
- **Logs.** The app writes no request log. It logs only startup, warnings (such as a failed sign-in at the provider) and errors, never names, notes or tokens. Request logs, if any, are the reverse proxy's; the operator sets how long they are kept and says so in the privacy policy.
- **Cookies** are strictly necessary (the session and the sign-in state), so no consent banner is needed.
- **Hosted operators** must publish a privacy policy and terms that cover parents as users, children's data processed on the parents' behalf, the hosting and sign-in providers as processors, and the retention periods. The app links to them from the sign-in page and Settings. This design is not legal advice: check GDPR (EU/UK) and COPPA (US) obligations for your situation.

### The operator

- `OPERATOR_ALLOWLIST` (same syntax as `PARENT_ALLOWLIST`) grants an operator page: counts of families, children and active devices, database size, version and health.
- Operators can't see any family's content through the app. Support access to a family needs a parent to grant it, for a limited time **(later)**.

### Performance

- One Node process with SQLite in WAL mode handles thousands of families with indexes on `(family_id, …)` for every table and `(family_id, child_id, day)` on entries.
- The state of one child is computed from that child's entries only. A per-family version number lets the 5-second refresh return `304 Not Modified` when nothing changed.

### Backups

- Nightly online backups (SQLite backup API) with an integrity check, kept 30 days (`KEEP_DAYS` in `scripts/backup.sh`), plus an off-site copy.
- In hosted mode, off-site copies are encrypted before they leave the server: `scripts/backup.sh` with `BACKUP_PUBLIC_KEY` encrypts each copy to the operator's public key (X25519 + HKDF-SHA256 + AES-256-GCM, `server/backup-crypto.js`, Node's built-in crypto only), into an `offsite` folder for another machine to pull. The private key never goes on the server.
- Restoring is tested on a copy before relying on it.

## Security

These hold in both modes.

- **Configuration fails fast.** Outside `localhost`, the app refuses to start without an `https://` `APP_BASE_URL`, a `SESSION_SECRET` of at least 32 characters, at least one sign-in provider with both its client ID and secret, or with any fake provider turned on. Errors name the variable.
- **HTTPS.** Plain HTTP is redirected to `APP_BASE_URL`, never to the request's Host header. Forwarded headers are trusted only from `FORWARDED_ALLOW_IPS`.
- **Headers.** HSTS, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` with everything off, and a Content Security Policy of `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'`. The page therefore has no inline scripts, inline styles or inline event handlers.
- **Writes** must be JSON and come from the app's own `Origin`.
- **Output.** Every user-entered string is escaped before it reaches the page.
- **Requests.** Bodies over 10 KB are refused. A client has 15 seconds to send its headers and 30 for the whole request. Static files are served only from `public/` by plain file name.
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
| `DELETE_IDLE_FAMILIES_DAYS` | Days without use before a family is deleted (`0`: never; at least 30) | 365 |
| `PUSH_REMINDERS` | `0` turns off evening reminders (see "Evening reminders") | On |
| `LIMIT_FAMILIES` | Most families the installation holds (see "Sign-up and abuse") | No cap |
| `SIGNUP_CONTACT_URL` | "Ask for a place" link on the private and full pages | None |
| `DATABASE_PATH` | SQLite file | `/data/little-wins.db` |
| `FORWARDED_ALLOW_IPS` | Proxies trusted for client IP and scheme | Empty |
| `PORT` | Listening port | `3000` |
| `LIMIT_*` | Overrides for "Limits" | Mode defaults |
| `LITTLE_WINS_FAKE_SSO` | Fake sign-in, localhost only | Off |
| `DEMO_FAMILIES` | `1` offers **Try a demo** (see "Demo families") | Off |
| `DEMO_MAX`, `DEMO_IDLE_SECONDS` | How many demo families at once; how long one lasts unused | 20; 1800 |
| `TOUR_VIDEO` | `0` hides **Watch the video** | On |

`DB` is still read as a fallback for `DATABASE_PATH`.

## Front end

- One HTML page, one script and one stylesheet, served as static files with no build step.
- Bottom tabs with icons: Today, Week, Rewards, History, and Settings for parents.
- Settings sections fold; each header shows a count.
- The page polls the state every 5 seconds while visible, keeping the selected week.
- **Icon.** A gold star on the app's navy: `public/icon.svg` (the favicon) and `icon-maskable.svg` (full bleed, for Android's maskable icon and iOS), drawn by hand; `scripts/icons.js` makes the PNG sizes the manifest and iOS need, and `favicon.ico`. The project page uses the same icon.
- **Light and dark.** The page follows the device's setting (`prefers-color-scheme`); there is no switch in the app. Every color is a token on `:root` in `style.css`, and a dark palette overrides the tokens (`color-scheme: light dark` lets form controls follow). Every text color reads at 4.5:1 or more on the backgrounds it is used on, in both themes (WCAG AA), and a test checks it. White text on colored buttons, the tour's orange outline and the video's black frame are the same in both.

## Languages

- The app speaks English, Chinese (Simplified), Spanish, French and German (`en`, `zh`, `es`, `fr`, `de`). English is the base: a missing translation falls back to it, key by key.
- **Per family.** `families.language` is chosen at setup (default: the browser's `Accept-Language` / `navigator.languages`, else English) and changed in Settings → Family. Every device of the family, children's included, follows it.
- **Before a family is known** (sign-in, pairing, setup, the server's sign-in error pages), the browser's language is used.
- **Dates, day letters and numbers** are formatted with `Intl` in the family's locale; calendar days stay `YYYY-MM-DD` in the API.
- **The starter list** is seeded in the family's language (`server/i18n/<lang>.js`, same order and points as English). Names a family typed are never translated, and changing the language does not rename them.
- **Page text** lives in `public/strings.<lang>.js` (`window.LW_STRINGS.<lang>`). The page loads English with itself and fetches another language on demand from its own origin (so the CSP holds).
- **Server text.** API errors keep an English `error` for logs and old pages, plus a stable `code` (the key in `server/messages.js`) and its parameters (`seconds`, `limit`); the page shows `STR.errors[code]`. The few pages the server renders itself use `server/i18n`. Startup refusals stay English (for the operator).
- The language choice is a set of radio buttons, each labeled in its own language (a `<select>` inserted as HTML trips WebKit's CSP check).

## Demo families

Demo families let anyone see Little Wins working, as a parent and as a child, with no sign-in. Each visitor gets a private family of their own with made-up history. They are off unless `DEMO_FAMILIES=1`.

- **Starting one.** With demo families on, the sign-in page offers **Try a demo**. It asks the server for a new demo family (`POST /api/demo/start`, rate limited like sign-in) and opens it as its parent. The page sends the browser's time zone and the language it is showing; the family uses them.
- **Memory only, never mixed.** Demo families live in a second SQLite database held in memory (`:memory:`), with the same migrations, data layer and routes as real families, but never the database file. A demo family can therefore never reach a real family, a backup or an export, and the operator's counts never include one. A restart ends every demo.
- **The demo session.** Its cookie is `lw_demo` (random token, only its SHA-256 hash stored, HttpOnly, SameSite=Strict, Secure outside localhost, no Max-Age, so it ends with the browser). While it is valid, the page's calls go to the demo family; the browser's real session, if any, is untouched and comes back when the demo is left. A `lw_demo` cookie for a demo that has ended gets `401` with the code `demoEnded`, and the page says the demo ended.
- **Idle time and limit.** A demo family is deleted after `DEMO_IDLE_SECONDS` (default 1800, 30 minutes) without a request from it, and at most `DEMO_MAX` (default 20) exist at once. Past the limit, **Try a demo** gets `503` with the code `demoFull`: a calm note that every demo family is busy and to try again in a few minutes, and the button stays to try again. The state carries the idle time, and the demo banner gives it.
- **The made-up family.** The parent is "Sam (demo)"; the children are Mia and Leo. The starter list in the family's language, and four weeks of history before today: points most days, the odd warning and penalty for the parent's view, and challenge marks that win Mia a few stars and Leo fewer. Mia has at least one reward unlocked and another in progress. Today's marks are left for the visitor to tap. The history is generated from a fixed seed, so every demo, guide picture and the video look alike. Nothing in it is a real person.
- **Parent's and child's view.** The demo banner, on every screen, says it is a demo with made-up data and when it is deleted, and offers **Child's view** (the selected child, exactly as that child's paired device would see it) or **Parent's view**, **Take the tour** and **Leave the demo**. Switching changes the demo session's kind (`POST /api/demo/view`); it is the one control a child's view shows beyond the child's own, and only in a demo. Leave the demo deletes the family at once (`POST /api/demo/leave`) and returns to the sign-in page.
- **What a demo can do.** Everything a parent does day to day: points, warnings, penalties, marks, undo, past weeks, and editing children, behaviors, penalties, challenges, rewards and the family's name, time zone, week start and language. **What it cannot** (`403`, code `demoOff`), each hidden from the demo's page with a short note: inviting a co-parent, removing a parent or handing over ownership, adding a child's device, logging devices out, exporting and deleting the family, the operator page, setup, and signing out (Leave the demo stands in for it). The per-family limits apply as usual.
- **Tour.** The banner's **Take the tour** is there every time, and the once-only offer is not shown in a demo (see "Tour").

## Tour

A short guided tour explains the app to whoever opens it, by role.

- **Offered once.** The first time a device shows a family, a note at the top offers **Take the tour** or **No thanks**. Either answer is kept on the device (`localStorage`, per role), so the note does not come back.
- **On demand.** **Take the tour** at the bottom of Settings (parents) starts it again; in a demo the banner offers it every time.
- **Steps by role.** A parent: earning points (the + button), warnings, penalties, weekly marks and the star rule, rewards and the progress ring, History and undo, Settings, and adding a child's device. A child: points and stars in the header, the next reward, ways to earn, the week's marks, and rewards. A step switches to the tab it explains.
- **How a step looks.** The part it explains is outlined and scrolled into view, and the rest dimmed (the page stays usable underneath); a caption, below or above the part so it never covers it, gives a title, a sentence or two, "Step 2 of 7", and Back, Next and Done (Close on every step). Escape closes the tour and returns focus where it was. A step whose part is missing (no penalties in the list) shows its caption on its own. With reduced motion, nothing animates.
- The tour is drawn by the page alone: no library, nothing sent to the server. Its text is in `public/strings.<lang>.js` like every page string.

## Guide pictures and the tour video

The pictures in the guides (`docs/images/`) are screenshots taken by `scripts/guide-pictures.js`, which runs the app with demo families on and drives the demo with Playwright at phone size. Run it again when a screen changes. They show only the demo's made-up family.

The 30-second tour video is recorded the same way (`scripts/tour-video.js`, to `docs/video/tour.webm`) and narrated from `docs/video/tour-voiceover.md`. GitHub does not play videos kept in a repository, so the narrated MP4 sits in `public/` and the app serves it at `/tour.mp4`, with byte ranges for Safari.

- **Watch the video** on the sign-in page opens it in a player over the page, playing at once; Close or Escape stops it. `TOUR_VIDEO=0` hides the button (it is on by default, and hidden anyway when `public/tour.mp4` is missing); `/tour.mp4` itself stays served.

## Open questions

Each has a working default; the owner decides.

| Question | Default until decided |
|---|---|
| Should rewards be redeemable (spend points, record it)? | No: milestones |
| Can a child's device see siblings' progress? | No |
| Passkeys as a sign-in option? | Later |
| Several families per parent? | One in v1 |
