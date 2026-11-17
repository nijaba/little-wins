# Little Wins admin guide

How to deploy, update, back up and restore Little Wins: for your own family (self-hosted), or for other families too ([hosting for other families](#hosting-for-other-families)). For using the app, see the [user guide](user-guide.md).

> **Internet-facing.** Little Wins is meant to face the internet, behind HTTPS. HTTPS is required everywhere except localhost. A private network (Tailscale, a VPN or your LAN) is still a fine extra layer, but you don't need it. Ready-made setups are in `deploy/`: [Caddy on a dedicated host](#option-a-caddy-on-a-dedicated-host) and [behind an existing nginx](#option-b-behind-an-existing-nginx).

## Where things live

| What | Where |
|---|---|
| Source code | `https://github.com/<owner>/little-wins` (branch `main`) |
| Server | Any Linux host with Docker Compose 2.24 or newer, reachable as `<user>@<server>` |
| App folder (git checkout) | `~/little-wins` |
| Database | `~/little-wins/data/little-wins.db` on the host, `/data/little-wins.db` in the container (owned by uid 10001, the container user; see [Data folder ownership](#data-folder-ownership)) |
| Settings and secrets | `~/little-wins/.env` (**not in git**), copied from `.env.example` |
| Port or other compose overrides | `~/little-wins/docker-compose.override.yml` (**not in git**, optional) |
| Backups | Nightly: `~/little-wins-backup/daily/` on the server. Manual: the same folder. Optional off-server copy: see [Pulling backups to another machine](#pulling-backups-to-another-machine-optional) |

Request path: browser or phone, then your reverse proxy (Caddy or nginx, which provides HTTPS), then the app on container port 3000 (on `127.0.0.1:<port>` of the host with nginx; on the compose network with Caddy).

### What is in git and what is not

- **In git:** code (`server/`, `public/`), `Dockerfile`, `scripts/`, `test/`, `deploy/` (Caddy and nginx setups), `docker-compose.yml` (no secrets, port 3000) and `.env.example` (placeholders only).
- **Not in git** (listed in `.gitignore`): `data/` and `*.db`, `.env`, `docker-compose.override.yml`.

`docker-compose.yml` reads your settings from `.env` (`env_file: .env`), so `git pull` stays clean. Docker Compose also merges `docker-compose.override.yml` on top of `docker-compose.yml` automatically, and the override wins. Use the override file only for things that are not application settings, such as the published port.

**Never put the secrets in `docker-compose.yml`**, and never commit `.env`, the override file or the database.

### Configuration

All of these are environment variables, normally set in `.env`.

| Variable | Meaning | Default |
|---|---|---|
| `APP_BASE_URL` | The public address, for example `https://<your-domain>`. Outside localhost it must start with `https://`. Used for the sign-in callbacks and for invite and device links. A trailing slash is ignored. | `http://localhost:<PORT>` |
| `SESSION_SECRET` | Signs the short-lived sign-in state cookie. At least 32 characters and not a placeholder. Generate with `openssl rand -hex 32`. | Random on localhost (sign-ins in progress end on restart); required elsewhere |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google sign-in. Set both or neither. | Off |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | GitHub sign-in. Set both or neither. | Off |
| `SIGNUP_MODE` | Who may create a family: `closed` (only people on `PARENT_ALLOWLIST`), `invite` (people with a family invite from the operator page, or on the allowlist) or `open` (anyone who signs in). See [Hosting for other families](#hosting-for-other-families). | `closed` |
| `DELETE_IDLE_FAMILIES_DAYS` | A family that no device has used for this many days is deleted, with everything it owns (at least 30; `0` turns it off). Parents see the rule in Settings. Unclaimed families are kept. | `365` |
| `LIMIT_FAMILIES` | The most families the installation holds, in any mode. Past it, new parents see "full for now"; co-parents can still join. Demo families don't count. | No cap |
| `SIGNUP_CONTACT_URL` | An `https://` page or `mailto:` address shown as **Ask for a place** on the private and full screens. The app collects no email itself. | None |
| `PARENT_ALLOWLIST` | Comma-separated list of who may create a family (or claim a migrated one) when sign-up is not `open`. Entries: `*`, `google:you@example.com`, `github:<login>`, `google-domain:example.com`. See below. | Empty |
| `FORWARDED_ALLOW_IPS` | Comma-separated proxy addresses whose `X-Forwarded-For` and `X-Forwarded-Proto` the app trusts. Exact IPs, or `*` for any peer (only safe when the app's port is reachable by the proxy alone). Outside localhost the app redirects plain HTTP to `APP_BASE_URL`, and it learns the original scheme from `X-Forwarded-Proto`, so behind a proxy this must be set. See [FORWARDED_ALLOW_IPS](#forwarded_allow_ips). | Empty (forwarded headers ignored) |
| `SITE_HOST` | Caddy setup only: the host name Caddy serves, the host part of `APP_BASE_URL`. | None |
| `OPERATOR_ALLOWLIST` | Who sees the operator page. Same entries as `PARENT_ALLOWLIST`. For hosting. | Empty |
| `PRIVACY_URL`, `TERMS_URL` | Links shown on the sign-in page and in Settings. For hosting. | None |
| `LIMIT_CHILDREN`, `LIMIT_PARENTS`, `LIMIT_ITEMS`, `LIMIT_REWARDS`, `LIMIT_DEVICES`, `LIMIT_ENTRIES_PER_DAY` | Per-family limits. | `SIGNUP_MODE=closed`: 20 / 10 / 500 / 200 / 50 / 2000. `open`: 8 / 6 / 200 / 100 / 30 / 500 |
| `DATABASE_PATH` | SQLite file inside the container. `docker-compose.yml` sets `/data/little-wins.db`. The older name `DB` still works if `DATABASE_PATH` is not set. | `/data/little-wins.db` |
| `PORT` | Port the app listens on inside the container. Leave it at 3000 with Docker and change the published port instead. | `3000` |
| `TZ` | Time zone of the container. Each family has its own time zone, so this only places data migrated from an old single-family install. | `UTC` |
| `DEMO_FAMILIES` | `1` offers **Try a demo** on the sign-in page: anyone, with no sign-in, gets a private demo family with made-up history, held in memory only (never in the database file, backups, exports or the operator's counts). See [Demo families](#demo-families). | Off |
| `DEMO_MAX` | How many demo families may exist at once. Past that, visitors are asked to try again in a few minutes. Each is small (a few hundred rows in memory). | `20` |
| `DEMO_IDLE_SECONDS` | How long a demo family lasts without a request, in seconds. | `1800` (30 minutes) |
| `TOUR_VIDEO` | `0` hides **Watch the video**, the 30-second tour, from the sign-in page. It is also hidden when `public/tour.mp4` is missing. `/tour.mp4` stays served either way. | On |
| `LITTLE_WINS_FAKE_SSO` | `1` replaces Google and GitHub with a fake sign-in page. Development only; refused unless `APP_BASE_URL` is localhost. | Off |

`PARENT_ALLOWLIST` entries:

- `*`: anyone who signs in. Only for localhost, or for an installation you want open to everyone.
- `google:you@example.com`: that Google account, matched on its verified email.
- `github:<login>`: that GitHub login (case does not matter).
- `google-domain:example.com`: any account in that Google Workspace domain.

The allowlist only decides who may *create* a family (or claim one). It is not a list of every parent: co-parents join by invite link and do not need an entry. A parent who already belongs to a family goes straight to it, whatever the allowlist says.

Family settings (name, time zone, week start, children) are not environment variables. Parents set them in **Settings** and they live in the database.

## Register the sign-in apps

Parents sign in with Google, GitHub or both. Each one needs an OAuth app that you register yourself, which gives you a client ID and a client secret. Both providers see only that someone signed in to your Little Wins.

Decide your public address first (`APP_BASE_URL`, for example `https://<your-domain>`), because each provider needs the exact callback address:

- Google: `<APP_BASE_URL>/auth/google/callback`
- GitHub: `<APP_BASE_URL>/auth/github/callback`

The address must match exactly: scheme, host, port and path, with no trailing slash. For local tests of a real provider you can register `http://localhost:3000/...` callbacks, but for everyday development use the fake sign-in instead.

### Google

The Google Cloud console changes its layout from time to time, so follow the names below loosely.

1. Open the Google Cloud console and create a project (or pick one) for Little Wins.
2. Set up the **OAuth consent screen** (in the console's "APIs & Services" area, which may be labeled Google Auth Platform in newer versions):
   - **User type:** *External* for personal Google accounts. *Internal* only if everyone is in your own Google Workspace.
   - **App name:** for example `Little Wins`. **User support email** and the developer contact email: your own address.
   - **Scopes:** `openid`, `email` and `profile` are the only ones needed (the basic sign-in scopes; no sensitive scopes).
   - **Publishing status:** while it is *Testing*, only the Google accounts you add as **test users** can sign in. That is fine for one family: add every parent's account. If you publish the app to *In production*, anyone with a Google account can reach the sign-in; Little Wins still turns them away unless they are on the allowlist or hold an invite. Basic sign-in scopes normally do not need Google's verification review.
3. Open the credentials page (APIs & Services → Credentials), choose **Create credentials → OAuth client ID**, and set **Application type** to **Web application**.
4. Under **Authorized redirect URIs**, add `<APP_BASE_URL>/auth/google/callback`. Leave the JavaScript origins empty; Little Wins does not use them.
5. Create it. Copy the **client ID** and **client secret** into `.env` as `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.

### GitHub

1. On GitHub, open your account's **Settings → Developer settings → OAuth Apps → New OAuth App**. (For an organization, use the organization's settings instead.)
2. **Application name:** for example `Little Wins`.
3. **Homepage URL:** your `APP_BASE_URL`.
4. **Authorization callback URL:** `<APP_BASE_URL>/auth/github/callback`.
5. Register the application. On its page, copy the **Client ID**, then choose **Generate a new client secret** and copy the secret (GitHub shows it once).
6. Put them in `.env` as `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`.

GitHub allowlist entries match the GitHub *login* (username), so `github:<login>` must be the username, not the display name.

### Keep the secrets safe

Client secrets live only in `.env` on the server. If one leaks, generate a new one in the provider's console, update `.env` and recreate the container.

## First start

1. Register the sign-in apps, fill in `.env` (see [Fresh install on a new server](#fresh-install-on-a-new-server)) and start the container.
2. Open `APP_BASE_URL` and sign in with Google or GitHub, using an account that is on `PARENT_ALLOWLIST`.
3. A short setup follows: family name, time zone (filled in from your browser), week start, language (your browser's, if the app speaks it), the first child's name, and the starter list of behaviors and rewards (in the family's language) or an empty one. You become the family's **owner**.
4. **After migrating an old single-family database** (one made before sign-in existed): the data becomes one family with one child and no parents. The first allowlisted parent to sign in *claims* it and becomes its owner, instead of going through setup. Everyone signs in again, because the old PIN sessions are dropped. The family's time zone starts as the server's, so check it under **Settings**.
5. Anyone who signs in but is not on the allowlist and holds no invite sees "This Little Wins is private" and is signed out.

### Adding a co-parent

In **Settings → Parents → Invite a parent**, the app shows an invite link. Send it to the other parent. The link works once and expires after 7 days. They open it, see the family's name, sign in with Google or GitHub, and join as a parent. They do not need to be on `PARENT_ALLOWLIST`. A person can belong to only one family, so someone who is already in a family is taken to that family instead. An unused invite can be revoked from the same list.

### Adding a child's device

Children have no account and no password. In **Settings → Devices**, choose **Add a device for <child>**. The app shows a one-time code (like `KD7Q-M3XA-PJ`) and a link. On the child's phone, open the link, or open Little Wins and type the code under "Use a code from a parent". The code works once and expires after 10 minutes. The phone then shows only that child. Make a new code for each device.

### Logging devices out

**Settings → Devices** lists every device of the family, parents' and children's, with the type, who it belongs to and when it was last used. **Log out** on a lost or old device ends its session at once. A child's device has to be paired again; a parent signs in again. Logging out "this device" signs you out here.

### Removing a parent and handing over ownership

Only the owner can do either, under **Settings → Parents**, after a confirmation.

- **Remove a parent** takes them out of the family. They can no longer open it.
- **Make owner** hands ownership to another parent. The old owner stays as a parent. There is no offer-and-accept step, so only do it for someone you trust.

You cannot remove or hand over to yourself.

### Exporting and deleting a family

Only the owner sees these, at the bottom of **Settings → Family**.

- **Download all our data** saves one JSON file with everything the family has: children, history, behaviors, rewards and parents (no session secrets).
- **Delete this family** removes the children, history, behaviors, rewards and devices for everyone in the family, and signs everybody out. It cannot be undone, and a backup of the whole database is the only way back. The owner types the family name exactly, then confirms once more. Download the data first.

### Languages

Little Wins speaks English, Chinese (Simplified), Spanish, French and German. Each family picks its language at setup (the browser's language by default) and can change it in **Settings → Family**; everyone in the family, children's devices included, then sees the app, dates and day letters in that language. Before a family is known (the sign-in screen, pairing a child's phone, sign-in error pages) the app follows the browser's language. Names the family typed (children, behaviors, rewards) are never translated; changing the language later does not rename the starter list.

**Adding a language** (for contributors):

1. Add its code to `LANGUAGES` in `server/i18n/index.js` and to `LANGS` (with the language's own name) in `public/app.js`.
2. Copy `server/i18n/en.js` to `server/i18n/<code>.js` and translate `pages` and `starter`, keeping the starter lists' lengths and order (points are shared).
3. Copy `public/strings.en.js` to `public/strings.<code>.js`, set `window.LW_STRINGS.<code>`, translate every key (functions stay functions with the same parameters) and set `locale` to a BCP 47 tag for `Intl`.
4. Update the `language` list in `docs/design.md`; the tests check that every translation has the English keys and starter lengths.

## Hosting for other families

The same code runs one family or many; the difference is configuration. Before you open an installation to other families, set it up as below, then follow the rest of this guide as usual (backups matter even more).

1. **Sign-up.** Pick one:
   - `SIGNUP_MODE=invite`: only families you invite. On the operator page, **Invite a family** makes a link (single use, 30 days) to send them; open invites are listed with **Cancel**. The family opens it, signs in with Google or GitHub, and sets up. Without a link, people see "This Little Wins is private".
   - `SIGNUP_MODE=open`: anyone who signs in with Google or GitHub can create a family. There is no sign-up form, so no passwords, emails or bots to deal with.

   Either way, `LIMIT_FAMILIES` caps how many families the installation holds: past it, new parents see "This Little Wins is full for now" (co-parents can still join an existing family, and an unused invite keeps working for later). Set `SIGNUP_CONTACT_URL` (an `https://` page or a `mailto:` address) to add **Ask for a place** to the private and full screens. You can start with `invite` and a small cap, and raise them as you go.
2. **Limits.** With `open`, the hosted defaults apply (8 children, 6 parents, 200 items, 100 rewards, 30 devices and 500 entries a day per family); see [Limits](#limits). Rate limits per client are always on: keep `FORWARDED_ALLOW_IPS` right, or every family shares your proxy's limit.
3. **Operator page.** Put yourself in `OPERATOR_ALLOWLIST` to see counts and health. You can't see any family's content through the app, by design. See [Operator page](#operator-page).
4. **Privacy policy and terms.** Publish both and set `PRIVACY_URL` and `TERMS_URL`; the app links to them from the sign-in page and Settings. Start from the templates in [docs/legal/](legal/): [privacy policy](legal/privacy-policy-template.md) and [terms of use](legal/terms-template.md). They describe what the software does, but they are not legal advice: check the GDPR (EU and UK), COPPA (US) and your local rules with someone qualified.
5. **Backups.** Keep the nightly backups, and an off-site copy encrypted before it leaves the server. Say how long you keep them in your privacy policy: deleted families stay in backups that long. `KEEP_DAYS` in [Automatic backups](#automatic-backups) sets it.
6. **Logs.** The app writes no request log. Your reverse proxy probably does: decide how long you keep its logs (14 days is plenty) and say so in the privacy policy.
7. **Demo families (optional).** `DEMO_FAMILIES=1` lets visitors try the app before signing in. Demo families are kept in memory only, apart from real ones. See [Demo families](#demo-families).
8. **Idle families.** `DELETE_IDLE_FAMILIES_DAYS` (365 by default) deletes families nobody has used for that long, at startup and every 6 hours; the log says how many. State the period in your privacy policy. Self-hosting for one family that uses the app, it never triggers; set `0` if you'd rather it never could.
9. **Security reports.** Point people who find a problem in the software to the project's [security policy](../SECURITY.md); problems with your own deployment come to you.

What families can do for themselves, with no help from you: invite a co-parent, hand over ownership, log out lost devices, download all their data, and delete their family (it is gone at once, and from the backups once they age out).

## Demo families

With `DEMO_FAMILIES=1` the sign-in page offers **Try a demo**. Each visitor gets a private family of their own, "Demo family" with the parent "Sam (demo)" and the children Mia and Leo, and a few weeks of made-up points, marks, stars and rewards. A banner on every screen says it is a demo, switches between the parent's and the child's view, offers the tour, and leaves the demo (which deletes it at once).

- **Memory only.** Demo families live in a second SQLite database in memory. They never touch `data/little-wins.db`, the backups, any export or the operator's counts, and a restart ends them all.
- **Limits.** A demo family is deleted after `DEMO_IDLE_SECONDS` without use (30 minutes by default); at most `DEMO_MAX` exist at once (20 by default), and starting one is rate limited like sign-in (10 a minute per client).
- **What a demo can't do:** invite a co-parent, remove a parent or hand over ownership, add a child's device, log devices out, export or delete the family, or see the operator page. Everything a parent does day to day works.
- Its cookie, `lw_demo`, is separate from the sign-in cookie and ends when the browser closes; a signed-in parent who tries the demo is back in their own family after leaving it.

## Tour and video

The page offers a short guided tour once per device and role (kept in the browser), and again from **Settings → Take the tour**; it is drawn by the page alone and sends nothing to the server. **Watch the video** on the sign-in page plays the 30-second narrated tour from `/tour.mp4` (`TOUR_VIDEO=0` hides the button). To remake the video or the guide pictures after a screen changes, see `scripts/tour-video.js`, `scripts/tour-voiceover.py` and `scripts/guide-pictures.js` (development machine only; they need Playwright's Chromium, and the voice-over needs its own Python environment described in the script).

## Operator page

For hosting: the people listed in `OPERATOR_ALLOWLIST` (same entries as `PARENT_ALLOWLIST`, e.g. `github:some-login`) see an **Operator** section at the bottom of Settings, which loads when it is opened. An operator who has no family of their own sees the Operator screen right after signing in, with a Refresh and a Sign out button.

It shows counts only: families, unclaimed families (no parent yet), parents, children, devices, devices active in the last 30 days, entries, database size in MB, version and uptime. It never shows names, history or any other family content, and an operator cannot open another family. Anyone else who asks for it gets a refusal.

## Limits

Each family has limits on children, parents, behaviors/penalties/challenges (items), rewards, devices, and entries recorded per day. Set them with `LIMIT_CHILDREN`, `LIMIT_PARENTS`, `LIMIT_ITEMS`, `LIMIT_REWARDS`, `LIMIT_DEVICES` and `LIMIT_ENTRIES_PER_DAY`. Without them the defaults depend on `SIGNUP_MODE`:

| | Children | Parents | Items | Rewards | Devices | Entries per day |
|---|---|---|---|---|---|---|
| `closed` (self-hosted) | 20 | 10 | 500 | 200 | 50 | 2000 |
| `open` or `invite` (hosted) | 8 | 6 | 200 | 100 | 30 | 500 |

What users see: when a limit is reached, adding a child, behavior, reward or device (or recording an entry) fails with "This family has reached its limit for ...". Nothing is half-saved and the form stays open. Remove something, or raise the limit and restart. Too many requests from one place get a "Too many tries" message with a wait time. The page retries by itself, without a message.

## Updating the server (the usual task)

1. Make changes on your machine, run the tests (`npm test`, see [Testing](#testing)), then commit and push to `main`.
2. On the server, back up, pull and rebuild:

```bash
ssh <user>@<server> 'cd ~/little-wins && mkdir -p ~/little-wins-backup && cp data/little-wins.db ~/little-wins-backup/little-wins-$(date +%F).db && git pull && docker compose up -d --build'
```

3. Check it:

```bash
ssh <user>@<server> 'cd ~/little-wins && docker compose ps && docker compose logs --tail 5'
```

The container should show `Up (healthy)` (the image checks `/healthz` every 30 seconds; the first check comes about 10 seconds after start), and the log should end with `up`. Then open the app in a browser. With the Caddy or nginx setup, add `-f deploy/caddy/docker-compose.yml --env-file .env` (or the nginx file) after `docker compose`, the same as when you started it.

The data is safe through updates: `data/` is only mounted into the container, never part of the image or of git. The app only ever *adds* columns or tables at startup, so new code works with an existing database. Devices stay signed in: sessions are stored in the database. (The one exception was the move from PINs to sign-in: that update drops the old PIN sessions.)


## Backup and restore

### Automatic backups

A cron job on the server runs [scripts/backup.sh](../scripts/backup.sh) every night. The script:

- takes a consistent copy with SQLite's online backup (safe while the app runs);
- checks the copy with `PRAGMA integrity_check`;
- writes `~/little-wins-backup/daily/little-wins-YYYY-MM-DD.db`;
- deletes copies older than 30 days.

It needs `python3` on the host (nothing else). You can override its settings with environment variables: `DB_FILE` (source database), `BACKUP_DIR` (destination) and `KEEP_DAYS` (default 30; it was 60 before, so an existing install keeps 30 days of copies after its next update unless you set it).

Add the job (this example runs at 03:00 server time; adjust to taste):

```bash
mkdir -p ~/little-wins-backup
(crontab -l 2>/dev/null; echo '0 3 * * * $HOME/little-wins/scripts/backup.sh >> $HOME/little-wins-backup/backup.log 2>&1') | crontab -
```

Check it is working:

```bash
ssh <user>@<server> 'tail -3 ~/little-wins-backup/backup.log; ls -lt ~/little-wins-backup/daily | head -4'
```

### Pulling backups to another machine (optional)

A backup on the same server does not survive losing the server. A simple pattern is to have a second machine pull the daily folder over SSH with a key that can do nothing else.

On the second machine, create a dedicated key:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/little_wins_backup_pull -N "" -C little-wins-backup-pull
```

On the server, add the public key to `~/.ssh/authorized_keys`, restricted to one fixed command with no shell, PTY or forwarding (use your real home path):

```
command="tar -C /home/<user>/little-wins-backup/daily -cf - .",restrict ssh-ed25519 AAAA… little-wins-backup-pull
```

Then pull on a schedule from the second machine, for example with cron (daily at 10:00):

```bash
mkdir -p ~/little-wins-backups/daily
(crontab -l 2>/dev/null; echo '0 10 * * * ssh -i ~/.ssh/little_wins_backup_pull -o IdentitiesOnly=yes <user>@<server> | tar -C $HOME/little-wins-backups/daily -xf - >> $HOME/little-wins-backups/pull.log 2>&1') | crontab -
```

On macOS you can use a launchd job instead of cron. Keep the destination folder outside Documents and Desktop, because macOS blocks background jobs from writing there. This pull never deletes anything, so the folder grows by one small file per day.

- **To revoke it** (for example if the second machine is lost), delete the line ending in `little-wins-backup-pull` from the server's `~/.ssh/authorized_keys`.
- **To stop it,** remove the cron or launchd entry on the second machine.

### Manual backup

Before anything risky (the update command above already does a plain copy):

```bash
ssh <user>@<server> 'cd ~/little-wins && scripts/backup.sh'
```

### Restore

Stop the app first. `data/` is owned by uid 10001, so this needs `sudo`, and the restored file must keep that owner:

```bash
ssh -t <user>@<server> 'cd ~/little-wins && docker compose down && sudo cp ~/little-wins-backup/daily/little-wins-<YYYY-MM-DD>.db data/little-wins.db && sudo chown 10001:10001 data/little-wins.db && docker compose up -d'
```

Anything recorded after the backup was taken is lost. Devices that signed in after it will have to sign in again, and children's devices paired after it need a new code, because sessions live in the database.

### Roll back the code

If an update misbehaves, list recent commits and check out an earlier one:

```bash
ssh <user>@<server> 'cd ~/little-wins && git log --oneline -5'
```

```bash
ssh <user>@<server> 'cd ~/little-wins && git checkout <commit> && docker compose up -d --build'
```

Run `git checkout main && git pull` to return to the latest version afterwards.

## Changing settings or secrets

Edit `~/little-wins/.env` on the server, then recreate the container so it reads the file again:

```bash
ssh <user>@<server> 'cd ~/little-wins && docker compose up -d'
```

- Changing `SESSION_SECRET` only interrupts sign-ins in progress. Signed-in devices stay signed in.
- Changing the allowlist changes who may create a family; it does not remove anyone who is already a parent.
- To rotate a provider's client secret, generate a new one in the provider's console, put it in `.env` and recreate the container.
- To log a device out, use **Settings → Devices**.

Generate a new secret with `openssl rand -hex 32`.

## Sessions

Each sign-in or device pairing creates a session for that phone or browser.

- **Cookie:** `lw_session` holds a random token (`HttpOnly`, `SameSite=Lax`, `Secure` outside localhost, valid one year). Sign-in itself uses a second cookie, `lw_oauth`, that lasts 10 minutes.
- **Database:** stores only a SHA-256 hash of the token, in the `sessions` table.
- **Cleanup:** sessions unused for a year are deleted.

## The startup check

On start the app prints any warnings, then refuses to run, prints `Refusing to start: …` with one line per problem and exits with code 1, if any of these is true:

- `APP_BASE_URL` is not a valid URL, or is not `https://` and not localhost;
- `SESSION_SECRET` is missing outside localhost, or is shorter than 32 characters, or is a placeholder (`change-me`, `change-this-long-random-string`);
- `LITTLE_WINS_FAKE_SSO=1` is set and `APP_BASE_URL` is not localhost;
- only one of a provider's `*_CLIENT_ID` and `*_CLIENT_SECRET` is set;
- no provider is configured, outside localhost;
- `SIGNUP_MODE` is not `closed`, `invite` or `open`;
- `PARENT_ALLOWLIST` has an entry the app can't read (each one is named).

On localhost, a missing `SESSION_SECRET` only produces a warning (a random one is used) and a missing provider only warns too. A refused start does not create a database.

This protects you from running with sample values when `.env` is missing or was not picked up.

## Fresh install on a new server

Requirements: Docker with Compose 2.24 or newer, and git. It needs HTTPS at your public address, which step 7 sets up with Caddy or nginx.

**1. Deploy key** (only if the repository is private; for a public clone over HTTPS you can skip steps 1 to 3 and use `git clone https://github.com/<owner>/little-wins.git ~/little-wins`). Create a key so the server can read the repository:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/little_wins_deploy -N "" -C little-wins-deploy-<server> && cat ~/.ssh/little_wins_deploy.pub
```

Add the printed key at `https://github.com/<owner>/little-wins` → Settings → Deploy keys, with **Allow write access unchecked**. Or, from a machine logged in with `gh`:

```bash
gh repo deploy-key add little_wins_deploy.pub -R <owner>/little-wins -t "<server> (read-only)"
```

**2. Trust GitHub's host key.** Check that the fingerprint printed is GitHub's published ED25519 one, `SHA256:+DiY3wvvV6TuJJhbpZisF/zLDA0zPMSvHdkr4UvCOqU`:

```bash
ssh-keyscan -t ed25519 github.com > /tmp/gh.key && ssh-keygen -lf /tmp/gh.key
```

If it matches:

```bash
cat /tmp/gh.key >> ~/.ssh/known_hosts && rm /tmp/gh.key
```

**3. Clone:**

```bash
GIT_SSH_COMMAND="ssh -i ~/.ssh/little_wins_deploy -o IdentitiesOnly=yes" git clone git@github.com:<owner>/little-wins.git ~/little-wins && cd ~/little-wins && git config core.sshCommand "ssh -i ~/.ssh/little_wins_deploy -o IdentitiesOnly=yes"
```

**4. Register the sign-in apps** for your public address, following [Register the sign-in apps](#register-the-sign-in-apps). You need the client ID and secret for at least one of Google and GitHub.

**5. Create `.env`** from the example, with real values:

```bash
cd ~/little-wins && cp .env.example .env && chmod 600 .env
```

Edit `.env`: set `APP_BASE_URL`, paste a new `SESSION_SECRET` (from `openssl rand -hex 32`), the client ID and secret of each provider you registered, and `PARENT_ALLOWLIST` with your own account, for example `google:you@example.com`. Leave `SIGNUP_MODE=closed` for one family. Remove or comment out any provider you did not register.

Behind nginx you can change the published port with `APP_PORT` in `.env` (see step 7). With the base `docker-compose.yml` alone, use a `docker-compose.override.yml` with `ports: !override ["127.0.0.1:3001:3000"]` under the `little-wins` service.

**Make the data folder writable** by the container user (uid 10001). The app runs as that user, not root, and the container's root filesystem is read-only, so `data/` is the only place it can write:

```bash
cd ~/little-wins && mkdir -p data && sudo chown -R 10001:10001 data
```

When moving from an existing server, copy its `data/little-wins.db` into `~/little-wins/data/` before starting, then run the `chown` above again so the file is owned by 10001. If it comes from a version that used PINs, it will be migrated on first start (see [First start](#first-start)).

**6. Choose how to publish it** (step 7), then check the config. The commands below use the base `docker-compose.yml`; with Caddy or nginx, add `-f deploy/<caddy|nginx>/docker-compose.yml --env-file .env` after `docker compose` and drop the `published:` check for Caddy.

```bash
cd ~/little-wins && docker compose config | grep -E 'APP_BASE_URL|SIGNUP_MODE|PARENT_ALLOWLIST|published'
```

You should see your values. Don't paste the full `docker compose config` output anywhere: it includes your secrets.

**7. Publish it.** HTTPS at `APP_BASE_URL` is required; the app listens in plain HTTP and refuses to run elsewhere than localhost on a non-`https://` address. Pick one option.

#### Option A: Caddy on a dedicated host

For a host where ports 80 and 443 are free. Caddy gets and renews the certificate itself.

1. Point a DNS record for your domain at the host and open ports 80, 443 and 443/udp.
2. In `.env`, set `APP_BASE_URL=https://kids.example.com` and `SITE_HOST=kids.example.com` (the same name).
3. Start it:

```bash
cd ~/little-wins && docker compose -f deploy/caddy/docker-compose.yml --env-file .env up -d --build
```

The app has no published port: only Caddy reaches it, over the compose network. That is why `deploy/caddy/docker-compose.yml` sets `FORWARDED_ALLOW_IPS: "*"` for it, and why you must not add `ports:` to the app service. Files: `deploy/caddy/` (see its README).

#### Option B: behind an existing nginx

For a host that already runs nginx and certbot. The app is published on `127.0.0.1:${APP_PORT:-3000}` only.

1. Start it (set `APP_PORT` in `.env` to use another port):

```bash
cd ~/little-wins && docker compose -f deploy/nginx/docker-compose.yml --env-file .env up -d --build
```

2. Install the server block and add TLS:

```bash
sudo cp deploy/nginx/little-wins.conf.example /etc/nginx/sites-available/little-wins.conf
sudo nano /etc/nginx/sites-available/little-wins.conf
sudo ln -s /etc/nginx/sites-available/little-wins.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d kids.example.com
```

3. Set `FORWARDED_ALLOW_IPS` in `.env` (next section), then recreate the container.

Files: `deploy/nginx/` (see its README).

#### FORWARDED_ALLOW_IPS

The app trusts `X-Forwarded-For` and `X-Forwarded-Proto` only from the addresses in `FORWARDED_ALLOW_IPS`. By default it trusts none, so it would see every request as plain HTTP from the proxy and keep redirecting. Set it to the proxy's address as the app sees it:

- **Caddy:** already set to `*` in the compose file. Nothing to do.
- **nginx:** with Docker's port publishing the app sees the Docker network gateway as the peer, not 127.0.0.1. Find it with `docker network inspect nginx_default --format '{{(index .IPAM.Config 0).Gateway}}'` (usually `172.17.0.1` or `172.18.0.1`), or use `*`, which is safe here because the port is bound to `127.0.0.1` only.

Never use `*` if the app's port is reachable by anyone other than your proxy.

#### Health check

The image checks `GET /healthz` every 30 seconds. `docker compose ps` shows `Up (healthy)` once it passes (about 10 seconds after start); `unhealthy` means the app is not answering, so read `docker compose logs --tail 50`.

**8. Nightly backups:** add the cron line from [Automatic backups](#automatic-backups), and optionally set up [pulling backups to another machine](#pulling-backups-to-another-machine-optional).

**9. First sign-in:** open `APP_BASE_URL` and sign in as the allowlisted parent (see [First start](#first-start)). Then add a co-parent and the children's devices, and on each phone use Share → Add to Home Screen.

## Troubleshooting

| Symptom | Check / fix |
|---|---|
| Phones can't reach the app | `docker compose ps` (is it `Up (healthy)`?), then your reverse proxy (Caddy: `docker compose -f deploy/caddy/docker-compose.yml logs caddy`; nginx: `sudo nginx -t` and its error log), DNS and the firewall. |
| Browser says too many redirects, or the app keeps redirecting to `APP_BASE_URL` | `FORWARDED_ALLOW_IPS` doesn't include the proxy's address, or the proxy doesn't send `X-Forwarded-Proto`. See [FORWARDED_ALLOW_IPS](#forwarded_allow_ips). |
| Container restarts or log shows `EACCES` / "unable to open database file" | `data/` isn't writable by uid 10001. Run `sudo chown -R 10001:10001 data` and restart. This is needed on an existing install whose `data/` was created by root. |
| Container keeps restarting; log says "Refusing to start" | Read the lines under it: each names the variable (`APP_BASE_URL`, `SESSION_SECRET`, a provider's client ID and secret, `SIGNUP_MODE`, `PARENT_ALLOWLIST`, `LITTLE_WINS_FAKE_SSO`). See [The startup check](#the-startup-check). Usually `.env` is missing or still has the placeholders. Fix it, then `docker compose up -d`. |
| Sign-in fails at Google or GitHub with "redirect_uri_mismatch" or a similar error | The callback registered with the provider doesn't match `<APP_BASE_URL>/auth/<provider>/callback` exactly (scheme, host, port, path, no trailing slash). Fix it in the provider's console, or fix `APP_BASE_URL`. |
| Sign-in says it took too long or started in another browser | The sign-in must finish in the same browser within 10 minutes. Try again from the start. |
| "That sign-in provider isn't set up here" | That provider's client ID and secret are not in `.env`. |
| Google sign-in says access is blocked, or the app isn't verified | The consent screen is in *Testing* and the account isn't a test user: add it, or publish the app. |
| "This Little Wins is private" | The account isn't on `PARENT_ALLOWLIST` and arrived without an invite. Add the account to the allowlist (check the entry matches: verified email for Google, GitHub *login*, or domain) and recreate the container, or ask a parent for an invite link and open it before signing in. |
| "This invite link doesn't work" | It expired (7 days) or was already used. Make a new one in Settings → Parents. |
| "That code doesn't work" on a child's phone | The code expired (10 minutes) or was used. Make a new one in Settings → Devices. |
| "Too many tries" | Sign-in and code entry are limited to 10 requests a minute per client. Wait a minute. |
| App listens on 3000 instead of your port | The override file is missing or wasn't picked up (or, with nginx, `APP_PORT` isn't in `.env`). Run `docker compose config \| grep published`. |
| Everyone logged out | The database was replaced or restored from a backup older than their sign-ins (sessions live in `little-wins.db`), or you migrated an old PIN-based database. Parents sign in again; children's devices need new codes. |
| A phone is lost | Settings → Devices → Log out on that device. |
| Days or weeks change at the wrong hour | Check the family's time zone and week start in Settings. (The container's `TZ` doesn't matter for families that were set up after sign-in arrived.) |
| `git pull` refuses: local changes | Someone edited a tracked file on the server. `git status` to see it; move settings into `.env` or the override file, then `git checkout -- <file>`. |
| Backup job does nothing | Check `~/little-wins-backup/backup.log`, and that `python3` is installed. |
| Errors in the app | `docker compose logs --tail 50`. |

The `ExperimentalWarning: SQLite is an experimental feature` line in the logs is normal on Node 24.

## Testing

From the project folder, with Node 22.13 or newer (the image uses Node 24):

```bash
npm test        # or: node --test
npm run lint    # Biome lint and format check
```

The tests include unit tests of the scoring rules and API tests that start the real server (`server/index.js`) on a free port with a throwaway database, never `data/`. The suite signs in through the fake provider, as the fake test people, the same way a parent would, and it includes cross-family isolation tests: one family can read, change and delete nothing of another family's. It also covers the startup check, sessions, invites, device codes and the child's view-only access.

Some tests depend on the current day, for example the star rule; they work on any day. The page itself (escaping, layout, the Content Security Policy) isn't covered by automated tests yet (Playwright arrives in phase 5); check it in a browser.

## Running locally by hand

```bash
npm run dev
```

This starts the server on port 3000 with the fake sign-in turned on, `PARENT_ALLOWLIST='*'` and a throwaway database at `/tmp/little-wins-dev.db`. Open http://localhost:3000, click **Sign in with Google** (or GitHub), and pick one of the fake test people on the page that appears. Pick another person in another browser profile to try invites and co-parents. Delete the database file to start over.

The fake sign-in only works when `APP_BASE_URL` is localhost. Never set `LITTLE_WINS_FAKE_SSO` on a real server; the app refuses to start if you do.
