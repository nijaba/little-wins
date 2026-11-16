/** Entry point: checks the configuration, opens the database and starts the HTTP server. */
const http = require('node:http');
const config = require('./config');

config.verify(); // before any database is opened

const db = require('./db').open(config.dbPath);
const messages = require('./messages');
const { createRouter } = require('./routes');
const { createSessions, createLockout } = require('./sessions');
const { serveStatic } = require('./static');

const handleApi = createRouter({ db, sessions: createSessions(db), lockout: createLockout() });

http
  .createServer(async (req, res) => {
    try {
      if (req.method === 'GET' && !req.url.startsWith('/api')) return serveStatic(req, res);
      await handleApi(req, res);
    } catch (err) {
      console.error(err);
      try {
        res.writeHead(500);
        res.end(JSON.stringify({ error: messages.serverError }));
      } catch {}
    }
  })
  .listen(config.port, () => console.log('up'));
