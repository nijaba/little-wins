# Little Wins admin guide

How to deploy, update, back up and restore a self-hosted Little Wins.

> **Before you put it on the internet.** HTTPS and the remaining internet hardening (security headers, trusted proxies, rate limits for all routes, container hardening, and Caddy and nginx examples) arrive in phase 4 of docs/build-plan.md. Until then, put Little Wins behind a reverse proxy with TLS, and prefer a private network.

## Where things live

| What | Where |
|---|---|
| Source code | `https://github.com/<owner>/little-wins` (branch `main`) |
| Server | Any Linux host with Docker Compose 2.24 or newer, reachable as `<user>@<server>` |
| App folder (git checkout) | `~/little-wins` |
| Database | `~/little-wins/data/little-wins.db` on the host, `/data/little-wins.db` in the container (owned by root, created by Docker) |
| Settings and secrets | `~/little-wins/.env` (**not in git**), copied from `.env.example` |
| Port or other compose overrides | `~/little-wins/docker-compose.override.yml` (**not in git**, optional) |
| Backups | Nightly: `~/little-wins-backup/daily/` on the server. Manual: the same folder. Optional off-server copy: see [Pulling backups to another machine](#pulling-backups-to-another-machine-optional) |

Request path: browser or phone, then your reverse proxy (or private network), then `127.0.0.1:<port>` on the server, then container port 3000.

### What is in git and what is not

- **In git:** code (`server/`, `public/`), `Dockerfile`, `scripts/`, `test/`, `docker-compose.yml` (no secrets, port 3000) and `.env.example` (placeholders only).
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
| `SIGNUP_MODE` | Who may create a family: `closed` (only people on `PARENT_ALLOWLIST`), `invite` or `open` (anyone who signs in). `invite` is meant for hosting, where an operator issues family invites. Those do not exist yet, so for now `invite` behaves like `closed`. | `closed` |
| `PARENT_ALLOWLIST` | Comma-separated list of who may create a family (or claim a migrated one) when sign-up is not `open`. Entries: `*`, `google:you@example.com`, `github:<login>`, `google-domain:example.com`. See below. | Empty |
| `DATABASE_PATH` | SQLite file inside the container. `docker-compose.yml` sets `/data/little-wins.db`. The older name `DB` still works if `DATABASE_PATH` is not set. | `/data/little-wins.db` |
| `PORT` | Port the app listens on inside the container. Leave it at 3000 with Docker and change the published port instead. | `3000` |
| `TZ` | Time zone of the container. Each family has its own time zone, so this only places data migrated from an old single-family install. | `UTC` |
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
3. A short setup follows: family name, time zone (filled in from your browser), week start, the first child's name, and the starter list of behaviors and rewards or an empty one. You become the family's **owner**.
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

The container should show `Up` with your port mapped to `3000/tcp`, and the log should end with `up`. Then open the app in a browser.

The data is safe through updates: `data/` is only mounted into the container, never part of the image or of git. The app only ever *adds* columns or tables at startup, so new code works with an existing database. Devices stay signed in: sessions are stored in the database. (The one exception was the move from PINs to sign-in: that update drops the old PIN sessions.)


## Backup and restore

### Automatic backups

A cron job on the server runs [scripts/backup.sh](../scripts/backup.sh) every night. The script:

- takes a consistent copy with SQLite's online backup (safe while the app runs);
- checks the copy with `PRAGMA integrity_check`;
- writes `~/little-wins-backup/daily/little-wins-YYYY-MM-DD.db`;
- deletes copies older than 60 days.

It needs `python3` on the host (nothing else). You can override its settings with environment variables: `DB_FILE` (source database), `BACKUP_DIR` (destination) and `KEEP_DAYS` (default 60).

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

Stop the app first. `data/` is owned by root, so this needs `sudo`:

```bash
ssh -t <user>@<server> 'cd ~/little-wins && docker compose down && sudo cp ~/little-wins-backup/daily/little-wins-<YYYY-MM-DD>.db data/little-wins.db && docker compose up -d'
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

Requirements: Docker with Compose 2.24 or newer, and git. Put it behind a reverse proxy you control that terminates TLS, and prefer a private network such as Tailscale (see step 7).

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

The default port is `127.0.0.1:3000`. To use another one (3001 in this example), create the override file. The service name under `services:` must match the one in `docker-compose.yml`, and `!override` makes the override replace the base `ports` list instead of adding to it:

```bash
cat > ~/little-wins/docker-compose.override.yml <<EOF
services:
  little-wins:
    ports: !override ["127.0.0.1:3001:3000"]
EOF
```

When moving from an existing server, copy its `data/little-wins.db` into `~/little-wins/data/` before starting. If it comes from a version that used PINs, it will be migrated on first start (see [First start](#first-start)).

**6. Check the config, then start:**

```bash
cd ~/little-wins && docker compose config | grep -E 'APP_BASE_URL|SIGNUP_MODE|PARENT_ALLOWLIST|published'
```

You should see your values and exactly one `published:` line with your port. Don't paste the full `docker compose config` output anywhere: it includes your secrets.

```bash
cd ~/little-wins && docker compose up -d --build
```

**7. Publish it.** The app listens only on `127.0.0.1:<port>` and speaks plain HTTP, so it needs something in front of it that provides HTTPS at `APP_BASE_URL`. Two options:

- **Tailscale:** with MagicDNS and HTTPS enabled, expose the port on your tailnet only:

  ```bash
  sudo tailscale serve --bg http://127.0.0.1:3001
  ```

  The address is then `https://<server>.<your-tailnet>.ts.net`; use it as `APP_BASE_URL` and in the provider callbacks.
- **Reverse proxy** (Caddy, nginx and so on) at `https://<your-domain>`, forwarding to `http://127.0.0.1:3001`. Phase 4 adds ready-made examples and the proxy-related settings; until then, prefer restricting it to your VPN or LAN.

**8. Nightly backups:** add the cron line from [Automatic backups](#automatic-backups), and optionally set up [pulling backups to another machine](#pulling-backups-to-another-machine-optional).

**9. First sign-in:** open `APP_BASE_URL` and sign in as the allowlisted parent (see [First start](#first-start)). Then add a co-parent and the children's devices, and on each phone use Share → Add to Home Screen.

## Troubleshooting

| Symptom | Check / fix |
|---|---|
| Phones can't reach the app | `docker compose ps` (is it `Up`?), then your reverse proxy or private network (for Tailscale, `tailscale serve status` should proxy to `127.0.0.1:<port>`). |
| Container keeps restarting; log says "Refusing to start" | Read the lines under it: each names the variable (`APP_BASE_URL`, `SESSION_SECRET`, a provider's client ID and secret, `SIGNUP_MODE`, `PARENT_ALLOWLIST`, `LITTLE_WINS_FAKE_SSO`). See [The startup check](#the-startup-check). Usually `.env` is missing or still has the placeholders. Fix it, then `docker compose up -d`. |
| Sign-in fails at Google or GitHub with "redirect_uri_mismatch" or a similar error | The callback registered with the provider doesn't match `<APP_BASE_URL>/auth/<provider>/callback` exactly (scheme, host, port, path, no trailing slash). Fix it in the provider's console, or fix `APP_BASE_URL`. |
| Sign-in says it took too long or started in another browser | The sign-in must finish in the same browser within 10 minutes. Try again from the start. |
| "That sign-in provider isn't set up here" | That provider's client ID and secret are not in `.env`. |
| Google sign-in says access is blocked, or the app isn't verified | The consent screen is in *Testing* and the account isn't a test user: add it, or publish the app. |
| "This Little Wins is private" | The account isn't on `PARENT_ALLOWLIST` and arrived without an invite. Add the account to the allowlist (check the entry matches: verified email for Google, GitHub *login*, or domain) and recreate the container, or ask a parent for an invite link and open it before signing in. |
| "This invite link doesn't work" | It expired (7 days) or was already used. Make a new one in Settings → Parents. |
| "That code doesn't work" on a child's phone | The code expired (10 minutes) or was used. Make a new one in Settings → Devices. |
| "Too many tries" | Sign-in and code entry are limited to 10 requests a minute per client. Wait a minute. |
| App listens on 3000 instead of your port | The override file is missing or wasn't picked up. Run `docker compose config \| grep published`. |
| Everyone logged out | The database was replaced or restored from a backup older than their sign-ins (sessions live in `little-wins.db`), or you migrated an old PIN-based database. Parents sign in again; children's devices need new codes. |
| A phone is lost | Settings → Devices → Log out on that device. |
| Days or weeks change at the wrong hour | Check the family's time zone and week start in Settings. (The container's `TZ` doesn't matter for families that were set up after sign-in arrived.) |
| `git pull` refuses: local changes | Someone edited a tracked file on the server. `git status` to see it; move settings into `.env` or the override file, then `git checkout -- <file>`. |
| Backup job does nothing | Check `~/little-wins-backup/backup.log`, and that `python3` is installed. |
| Errors in the app | `docker compose logs --tail 50`. |

The `ExperimentalWarning: SQLite is an experimental feature` line in the logs is normal on Node 24.

## Testing

From the project folder, with Node 22.5 or newer (the image uses Node 24):

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
