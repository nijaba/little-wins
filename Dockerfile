FROM node:24-alpine
WORKDIR /app
COPY server server
COPY public public
# Time zones are per family (Settings → Family), so the container's own zone doesn't matter.
ENV DATABASE_PATH=/data/little-wins.db
VOLUME /data
CMD ["node","server/index.js"]
