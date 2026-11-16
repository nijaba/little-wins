# Little Wins admin guide

How to deploy, update, back up and restore a self-hosted Little Wins.

> **Login is still PIN-based.** Before exposing Little Wins to the internet, wait for Google/GitHub sign-in and device pairing (see docs/build-plan.md, phase 3). Until then, keep it on a private network.

## Where things live

| What | Where |
|---|---|
| Source code | `https://github.com/<owner>/little-wins` (branch `main`) |
| Server | Any Linux host with Docker Compose 2.24 or newer, reachable as `<user>@<server>` |
| App folder (git checkout) | `~/little-wins` |
| Database | `~/little-wins/data/little-wins.db` on the host, `/data/little-wins.db` in the container (owned by root, created by Docker) |
| PINs, secret, port | `~/little-wins/docker-compose.override.yml` (**not in git**) |
| Backups | Nightly: `~/little-wins-backup/daily/` on the server. Manual: the same folder. Optional off-server copy: see [Pulling backups to another machine](#pulling-backups-to-another-machine-optional) |

Request path: browser or phone, then your private network or reverse proxy, then `127.0.0.1:<port>` on the server, then container port 3000.

### What is in git and what is not

- **In git:** code (`server.js`, `public/`), `Dockerfile`, `scripts/`, `test/`, and `docker-compose.yml` with **placeholder** PINs and port 3000.
- **Not in git** (listed in `.gitignore`): `data/` and `*.db`, `docker-compose.override.yml`, `.env`.

Docker Compose automatically merges `docker-compose.override.yml` on top of `docker-compose.yml`, and the override wins. That is how the server gets its real PINs, secret and port while `git pull` stays clean.

**Never put real PINs or the secret in `docker-compose.yml`**, and never commit the override file.

### Configuration

| Variable | Meaning |
|---|---|
| `PARENT_PIN` | PIN for the parent role (full access). |
| `CHILD_PIN` | PIN for the child role (view only; never sees penalties or notes). Must differ from `PARENT_PIN`. |
| `SECRET` | At least 16 characters. Today it is only checked by the startup check; changing it logs no one out. |
| `TZ` | Time zone of the container. It decides where "today" and the week boundaries fall, so set it to your own. |
| `DB` | Database path inside the container. Set to `/data/little-wins.db` by the Dockerfile. |
| `PORT` | Port the app listens on. Default 3000. |
| `ALLOW_DEFAULTS` | `1` skips the startup check. For local testing only. |

The child's name is not configured here. A parent sets it in **Settings → Child**, and it is stored in the database.

## Updating the server (the usual task)

1. Make changes on your machine, run the smoke test (`node --test`, see [Testing](#testing)), then commit and push to `main`.
2. On the server, back up, pull and rebuild:

```bash
ssh <user>@<server> 'cd ~/little-wins && mkdir -p ~/little-wins-backup && cp data/little-wins.db ~/little-wins-backup/little-wins-$(date +%F).db && git pull && docker compose up -d --build'
```

3. Check it:

```bash
ssh <user>@<server> 'cd ~/little-wins && docker compose ps && docker compose logs --tail 5'
```

The container should show `Up` with your port mapped to `3000/tcp`, and the log should end with `up`. Then open the app in a browser.

The data is safe through updates: `data/` is only mounted into the container, never part of the image or of git. The app only ever *adds* columns or tables at startup, so new code works with an existing database. Devices stay logged in: sessions are stored in the database.

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

Devices that logged in after the backup was taken will have to log in again, because sessions live in the database.

### Roll back the code

If an update misbehaves, list recent commits and check out an earlier one:

```bash
ssh <user>@<server> 'cd ~/little-wins && git log --oneline -5'
```

```bash
ssh <user>@<server> 'cd ~/little-wins && git checkout <commit> && docker compose up -d --build'
```

Run `git checkout main && git pull` to return to the latest version afterwards.

## Changing the PINs or the secret

Edit `~/little-wins/docker-compose.override.yml` on the server, then recreate the container:

```bash
ssh <user>@<server> 'cd ~/little-wins && docker compose up -d'
```

- Changing a PIN does not log anyone out. To sign out a device, use **Settings → Devices**.
- Changing `SECRET` does not log anyone out either. It must still be at least 16 characters and not a placeholder, or the app refuses to start.

Generate a new secret with `openssl rand -hex 32`.

## Logged-in devices

Each login creates a session for that phone or browser. **Settings → Devices** (parent only) lists them with the device type, role and when each was last used. **Log out** on a lost or old device makes it ask for the PIN again. Logging out "this device" signs you out here.

- **Cookie:** holds a random token (`HttpOnly`, `SameSite=Strict`, valid one year).
- **Database:** stores only a SHA-256 hash of the token, in the `sessions` table.
- **Cleanup:** sessions unused for a year are deleted.

## The startup check

On start the app refuses to run, prints `Refusing to start: …` and exits with code 1 if any of these is true:

- `PARENT_PIN` or `CHILD_PIN` is a placeholder (`1234`, `0000`, `change-me` or `change-this-long-random-string`);
- `PARENT_PIN` and `CHILD_PIN` are the same;
- `SECRET` is a placeholder or shorter than 16 characters.

This protects you from running with the sample values in `docker-compose.yml` when the override file is missing or was not picked up. A refused start does not create a database.

## Fresh install on a new server

Requirements: Docker with Compose 2.24 or newer (the override file uses `!override`), and git. Use a private network such as Tailscale, or a reverse proxy you control (see step 6).

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

**4. Create the override file** with real values. Pick any free local port (3001 in this example) and your own time zone:

```bash
cat > ~/little-wins/docker-compose.override.yml <<EOF
services:
  little-wins:
    ports: !override ["127.0.0.1:3001:3000"]
    environment:
      PARENT_PIN: "<parent pin>"
      CHILD_PIN: "<child pin>"
      SECRET: "$(openssl rand -hex 32)"
      TZ: "<your time zone, e.g. America/Chicago>"
EOF
chmod 600 ~/little-wins/docker-compose.override.yml
```

The service name under `services:` must match the one in `docker-compose.yml`. `!override` makes the override replace the base `ports` list instead of adding to it.

When moving from an existing server, copy its `data/little-wins.db` (which holds the sessions, so devices stay logged in) into `~/little-wins/data/` before starting.

**5. Check the config, then start:**

```bash
cd ~/little-wins && docker compose config | grep -E 'PIN|SECRET|published'
```

You should see the real values and exactly one `published:` line with your port.

```bash
cd ~/little-wins && docker compose up -d --build
```

**6. Publish it.** The app listens only on `127.0.0.1:<port>`, and login is PIN-based, so keep it on a private network for now. Two options:

- **Tailscale:** with MagicDNS and HTTPS enabled, expose the port on your tailnet only:

  ```bash
  sudo tailscale serve --bg http://127.0.0.1:3001
  ```

  The address is then `https://<server>.<your-tailnet>.ts.net`.
- **Reverse proxy** (Caddy, nginx and so on) at `https://<your-domain>`, forwarding to `http://127.0.0.1:3001`, restricted to your VPN or LAN. Do not open it to the public internet until the sign-in work in docs/build-plan.md, phase 3 is done.

**7. Nightly backups:** add the cron line from [Automatic backups](#automatic-backups), and optionally set up [pulling backups to another machine](#pulling-backups-to-another-machine-optional).

**8. On each phone:** open the address in the browser and log in, then use Share → Add to Home Screen. Then, as a parent, open **Settings → Child** to set the child's name and edit the starter items and rewards.

## Troubleshooting

| Symptom | Check / fix |
|---|---|
| Phones can't reach the app | `docker compose ps` (is it `Up`?), then your private network or proxy (for Tailscale, `tailscale serve status` should proxy to `127.0.0.1:<port>`). |
| Container keeps restarting; log says "Refusing to start" | See [The startup check](#the-startup-check). Usually the override file is missing or wasn't picked up. Fix it, then `docker compose up -d`. |
| App listens on 3000 instead of your port | The override file is missing or wasn't picked up. Run `docker compose config \| grep published`. |
| "Too many wrong PINs" | 5 wrong PINs lock login for 30 s, doubling each time up to 15 min. The lock is global, not per address. Wait, or `docker compose restart` to clear it. Devices already logged in keep working. |
| Everyone logged out | The database was replaced or restored from a backup older than their logins (sessions live in `little-wins.db`). Log in again with the PIN. |
| A phone is lost | Settings → Devices → Log out on that device. |
| Days or weeks change at the wrong hour | `TZ` in the override file is wrong. Fix it and run `docker compose up -d`. |
| `git pull` refuses: local changes | Someone edited a tracked file on the server. `git status` to see it; move PINs/port into the override file, then `git checkout -- <file>`. |
| Backup job does nothing | Check `~/little-wins-backup/backup.log`, and that `python3` is installed. |
| Errors in the app | `docker compose logs --tail 50`. |

The `ExperimentalWarning: SQLite is an experimental feature` line in the logs is normal on Node 24.

## Testing

From the project folder, with Node 22.5 or newer (the image uses Node 24):

```bash
node --test
```

[test/smoke.test.js](../test/smoke.test.js) starts `server.js` on a free port with a throwaway database (never `data/`) and checks:

- the startup check refuses placeholder PINs, a placeholder or short secret, and identical PINs, without creating a database;
- static files are served and paths like `/../server.js` are blocked;
- login: wrong PIN, roles, and forged or altered cookies;
- session tokens are stored hashed, not as-is;
- devices: listed for parents only, and can be logged out (another device, and your own);
- request bodies over 10 KB are refused;
- the seed data;
- the child's view-only access, and that the child never sees penalties or notes;
- points (fixed, ranged and clamped), the balance floor at 0, and undo;
- warnings per target per day, and that challenges cannot get points;
- weekly challenge marks, the star rule and day validation;
- browsing past weeks (limits at both ends) and fixing marks on past days;
- adding, editing, reordering and removing items and rewards;
- the child's name as a parent setting, shown to everyone;
- bad requests not crashing the server;
- data and logins surviving a restart;
- the PIN lockout.

On a Monday the star-rule part is skipped, since it needs two days of the current week. The frontend (escaping, layout) isn't covered; check it in a browser.

## Running locally by hand

The startup check blocks the placeholder PINs, so pass `ALLOW_DEFAULTS=1` and a throwaway database (parent PIN `1234`, child PIN `0000`):

```bash
ALLOW_DEFAULTS=1 DB=/tmp/lw.db node server.js
```

Then open http://localhost:3000. Never set `ALLOW_DEFAULTS` on a real server.
