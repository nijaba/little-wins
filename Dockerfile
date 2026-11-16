FROM node:24-alpine
WORKDIR /app
COPY server server
COPY public public
# TZ sets "today" and week boundaries until per-family time zones arrive (design.md).
ENV DB=/data/little-wins.db TZ=UTC
VOLUME /data
CMD ["node","server/index.js"]
