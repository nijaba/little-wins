# node:24-alpine, pinned by digest so builds are repeatable. To update: docker pull node:24-alpine,
# then docker inspect --format '{{index .RepoDigests 0}}' node:24-alpine
FROM node@sha256:e18c3ccdf7d71619990b0e85639f506e2028a95410999cab24cc373cbd10e0ac

# Fixed uid/gid so the host data folder can be chowned to a known id. The app has no runtime
# dependencies and runs on `node` alone, so the package managers that ship with the base image
# (npm, npx, corepack, yarn) are removed: smaller image, and their bundled packages can't carry
# vulnerabilities into it.
RUN addgroup -S -g 10001 app && adduser -S -u 10001 -G app app \
 && mkdir /data && chown app:app /data \
 && rm -rf /usr/local/lib/node_modules /opt/yarn-* \
      /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /usr/local/bin/yarn /usr/local/bin/yarnpkg

WORKDIR /app
COPY server server
COPY public public
COPY package.json package.json

# Time zones are per family (Settings -> Family), so the container's own zone doesn't matter.
ENV NODE_ENV=production DATABASE_PATH=/data/little-wins.db PORT=3000
VOLUME /data
USER app
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node","server/index.js"]
