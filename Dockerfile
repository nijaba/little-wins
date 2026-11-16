# node:24-alpine, pinned by digest so builds are repeatable. To update: docker pull node:24-alpine,
# then docker inspect --format '{{index .RepoDigests 0}}' node:24-alpine
FROM node@sha256:116b800c3754b440ee0aa3ed2f20f5bf3d99a554bfd9adeea09ea8017f6e85f5

# Fixed uid/gid so the host data folder can be chowned to a known id.
RUN addgroup -S -g 10001 app && adduser -S -u 10001 -G app app \
 && mkdir /data && chown app:app /data

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
