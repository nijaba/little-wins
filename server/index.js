/** Entry point: checks the configuration, opens the database and starts the HTTP server. */
const http = require('node:http');
const config = require('./config');
const messages = require('./messages');
const { apiError } = require('./http');

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
const { clientInfo, setSecurityHeaders, redirectToHttps } = require('./web');

const repo = createRepo(db);
// Emails to the operator (NOTIFY_EMAIL): sign-ups, the limit reached, turned away, deletions.
const alerts = config.notify ? require('./alerts').createAlerts({ repo }) : null;
if (alerts) console.warn(`Operator emails are ON (${[...config.notify.events].join(', ')})`);

// Families no device has used for DELETE_IDLE_FAMILIES_DAYS are deleted: at startup, then every
// 6 hours. Only the count is logged.
function sweepIdleFamilies() {
  if (!config.idleFamilyDays) return;
  const before = new Date(Date.now() - config.idleFamilyDays * 864e5).toISOString();
  const n = repo.deleteIdleFamilies(before);
  if (n) console.log(`Deleted ${n} idle ${n === 1 ? 'family' : 'families'}`);
  if (n) alerts?.familyDeleted('idle', n);
}
sweepIdleFamilies();
setInterval(sweepIdleFamilies, 6 * 3600e3).unref();

// Evening reminders (Web Push), for parent devices that turned them on.
const reminders = config.push ? require('./reminders').createReminders({ repo }) : null;
if (reminders) setInterval(() => reminders.tick().catch(() => {}), config.pushIntervalMs).unref();
const sessions = createSessions(db);
const limiter = createRateLimiter(config.rateLimit);
const { reads, writes, windowMs } = config.apiRateLimit;
const readLimiter = createRateLimiter({ max: reads, windowMs });
const writeLimiter = createRateLimiter({ max: writes, windowMs });
const auth = createAuth({ repo, sessions, limiter, clientIp });
// Notices on a child's device (a reward unlocked, a milestone), where a parent allowed them.
const notices = config.push ? require('./notices').createNotices({ repo }) : null;
const handleApi = createRouter({
  repo,
  sessions,
  limiter,
  clientIp,
  reminders,
  notices,
  alerts,
});
// Demo families, in memory only (DEMO_FAMILIES=1).
const demo = config.demo.on ? require('./demo').createDemo({ limiter, clientIp }) : null;
if (demo) console.warn(`Demo families are ON (at most ${config.demo.max})`);

const server = http
  .createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://x');
      req.lw = clientInfo(req);
      setSecurityHeaders(res);
      if (redirectToHttps(req, res, req.lw, url.pathname)) return;

      if (url.pathname === '/healthz') {
        db.prepare('SELECT 1').get(); // throws (500) if the database is unusable
        res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        return res.end('{"status":"ok"}');
      }
      const auth_ = /^\/auth\/(google|github)\/(login|callback)$/.exec(url.pathname);
      if (auth_ && req.method === 'GET') {
        return auth_[2] === 'login'
          ? auth.login(req, res, auth_[1], url.searchParams)
          : await auth.callback(req, res, auth_[1], url.searchParams);
      }
      if (config.fakeSso && url.pathname.startsWith('/_fake-sso/'))
        return await handleFakeSso(req, res, url);
      if (url.pathname.startsWith('/api/')) {
        const write = req.method !== 'GET';
        const wait = (write ? writeLimiter : readLimiter).hit(clientIp(req));
        if (wait) {
          res.writeHead(429, { 'Content-Type': 'application/json', 'Retry-After': String(wait) });
          return res.end(JSON.stringify(apiError('tooManyTries', { seconds: wait })));
        }
        if (demo?.wants(req, url.pathname)) return await demo.handle(req, res);
        return await handleApi(req, res);
      }
      if (req.method === 'GET' || req.method === 'HEAD') return serveStatic(req, res);
      res.writeHead(405, { Allow: 'GET, HEAD' });
      res.end();
    } catch (err) {
      console.error(err);
      try {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(apiError('serverError')));
      } catch {}
    }
  })
  .listen(config.port, () => console.log('up'));
// A client gets 15 seconds to send its headers and 30 for the whole request (bodies are 10 KB
// at most), so slow connections can't hold the process's sockets open for minutes.
server.headersTimeout = 15e3;
server.requestTimeout = 30e3;

// Graceful shutdown (docker stop, Ctrl-C): stop taking requests, close the database, exit
// normally (which also lets coverage tools write their data). Give up after 5 seconds.
function shutdown() {
  server.close(() => {
    try {
      db.close();
    } catch {}
    process.exit(0);
  });
  server.closeAllConnections?.();
  setTimeout(() => process.exit(0), 5000).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
