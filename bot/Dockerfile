# The Little Wins Telegram bot (optional; the app doesn't need it). Build from the repository root:
#   docker compose -f bot/docker-compose.yml up -d --build
# Same pinned base image as the app (see the root Dockerfile for how to update the digest).
FROM node@sha256:116b800c3754b440ee0aa3ed2f20f5bf3d99a554bfd9adeea09ea8017f6e85f5 AS deps
WORKDIR /bot
COPY bot/package.json bot/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

FROM node@sha256:116b800c3754b440ee0aa3ed2f20f5bf3d99a554bfd9adeea09ea8017f6e85f5
# Its own user, and no package managers in the final image (as for the app).
RUN addgroup -S -g 10002 bot && adduser -S -u 10002 -G bot bot \
 && mkdir /data && chown bot:bot /data \
 && rm -rf /usr/local/lib/node_modules /opt/yarn-* \
      /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /usr/local/bin/yarn /usr/local/bin/yarnpkg
WORKDIR /bot
COPY --from=deps /bot/node_modules node_modules
COPY bot/package.json package.json
COPY bot/src src
# The bot answers only from these: the app's guides and design, as of this build.
COPY docs/user-guide.md docs/admin-guide.md docs/design.md knowledge/
ENV NODE_ENV=production BOT_DATA=/data
VOLUME /data
USER bot
CMD ["node","src/index.js"]
