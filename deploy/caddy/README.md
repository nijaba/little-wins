# Caddy (dedicated host)

Runs Little Wins and Caddy together. Caddy gets and renews the HTTPS certificate, redirects
HTTP to HTTPS and forwards to the app. Use this on a host where nothing else uses ports 80
and 443.

1. Point a DNS record for your domain at the host and open ports 80 and 443 (and 443/udp).
2. In `.env` set `APP_BASE_URL=https://kids.example.com` and `SITE_HOST=kids.example.com`
   (the same host name), plus the other settings from `.env.example`.
3. Make the data folder writable by the container user:

```bash
mkdir -p data && sudo chown -R 10001:10001 data
```

4. Start it from the repository root:

```bash
docker compose -f deploy/caddy/docker-compose.yml --env-file .env up -d --build
docker compose -f deploy/caddy/docker-compose.yml ps
```

The app is not published on the host. Compose sets `FORWARDED_ALLOW_IPS: "*"` for it, which
is safe only because Caddy is the one thing that can reach it on the compose network. Do not
add a `ports:` entry to the app service.
