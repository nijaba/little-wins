# nginx (existing host with certbot)

For a host that already runs nginx. The app is published on `127.0.0.1:${APP_PORT:-3000}`
only; nginx terminates HTTPS and forwards to it.

1. In `.env` set `APP_BASE_URL=https://kids.example.com` and the other settings.
2. Make the data folder writable by the container user, then start the app:

```bash
mkdir -p data && sudo chown -R 10001:10001 data
docker compose -f deploy/nginx/docker-compose.yml --env-file .env up -d --build
```

3. Install the server block, then add TLS with certbot:

```bash
sudo cp deploy/nginx/little-wins.conf.example /etc/nginx/sites-available/little-wins.conf
sudo nano /etc/nginx/sites-available/little-wins.conf   # set server_name (and the port)
sudo ln -s /etc/nginx/sites-available/little-wins.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d kids.example.com
```

## FORWARDED_ALLOW_IPS

The app ignores `X-Forwarded-For` and `X-Forwarded-Proto` unless the connecting address is in
`FORWARDED_ALLOW_IPS`. Without it the app thinks every request is plain HTTP and redirects
forever. With Docker's port publishing, the app sees the Docker bridge gateway as the peer,
not 127.0.0.1. Find it:

```bash
docker network inspect nginx_default --format '{{(index .IPAM.Config 0).Gateway}}'
```

(Compose names the network after the folder of the compose file, here `nginx_default`; check
`docker network ls` if yours differs.) Put that address in `.env`, for example
`FORWARDED_ALLOW_IPS=172.18.0.1` (the default bridge is usually `172.17.0.1`).

Or set `FORWARDED_ALLOW_IPS=*`. That is safe here because the port is bound to 127.0.0.1, so
only processes on this host can reach the app. Do not use `*` if you publish the port on
other addresses.
