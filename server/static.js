/** Static files from public/, by plain file name only. Anything else is a 404. */
const fs = require('node:fs');
const path = require('node:path');

const PUBLIC = path.join(__dirname, '..', 'public');

const TYPES = {
  html: 'text/html; charset=utf-8',
  js: 'text/javascript; charset=utf-8',
  css: 'text/css; charset=utf-8',
  json: 'application/json',
  png: 'image/png',
  svg: 'image/svg+xml',
  webmanifest: 'application/manifest+json',
};

const CSP =
  "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; manifest-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'";

function serveStatic(req, res) {
  const pathname = req.url.split('?')[0];
  const name = pathname === '/' ? 'index.html' : pathname.slice(1);
  const file = path.join(PUBLIC, name);
  if (!/^[\w.-]+$/.test(name) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404);
    return res.end();
  }
  const ext = name.split('.').pop();
  const headers = {
    'Content-Type': TYPES[ext] || 'text/plain',
    'X-Content-Type-Options': 'nosniff',
  };
  if (ext === 'html') headers['Content-Security-Policy'] = CSP;
  res.writeHead(200, headers);
  res.end(fs.readFileSync(file));
}

module.exports = { serveStatic };
