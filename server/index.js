/** Entry point: checks the configuration, opens the database and starts the HTTP server. */
const http = require('node:http');
const config = require('./config');
const messages = require('./messages');

for (const warning of config.warnings) console.warn(`Warning: ${warning}`);
if (config.problems.length) {
  console.error(messages.refusingToStart(config.problems));
  process.exit(1); // before any database is opened
}
if (config.fakeSso) console.warn('Warning: fake sign-in is ON (development only)');

const db = require('./db').open(config.dbPath);
const { createRepo } = require('./repo');
const { createSessions } = require('./sessions');
const { createRateLimiter, clientIp } = require('./ratelimit');
const { createAuth } = require('./auth');
const { createRouter } = require('./routes');
const { serveStatic } = require('./static');
const { handleFakeSso } = require('./fake-sso');

const repo = createRepo(db);
const sessions = createSessions(db);
const limiter = createRateLimiter(config.rateLimit);
const auth = createAuth({ repo, sessions, limiter, clientIp });
const handleApi = createRouter({ repo, sessions, limiter, clientIp });

http
  .createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://x');
      const auth_ = /^\/auth\/(google|github)\/(login|callback)$/.exec(url.pathname);
      if (auth_ && req.method === 'GET') {
        return auth_[2] === 'login'
          ? auth.login(req, res, auth_[1], url.searchParams)
          : await auth.callback(req, res, auth_[1], url.searchParams);
      }
      if (config.fakeSso && url.pathname.startsWith('/_fake-sso/'))
        return await handleFakeSso(req, res, url);
      if (url.pathname.startsWith('/api/')) return await handleApi(req, res);
      if (req.method === 'GET' || req.method === 'HEAD') return serveStatic(req, res);
      res.writeHead(405, { Allow: 'GET, HEAD' });
      res.end();
    } catch (err) {
      console.error(err);
      try {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: messages.serverError }));
      } catch {}
    }
  })
  .listen(config.port, () => console.log('up'));
