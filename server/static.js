/**
 * Static files from public/. The files are listed once at startup, and a request can only
 * name one of them: a request never builds a file path, so it can't reach anything else.
 */
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

// Plain file names in public/ (no folders), mapped to their full paths.
const FILES = new Map(
  fs
    .readdirSync(PUBLIC, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /^[\w.-]+$/.test(entry.name))
    .map((entry) => [entry.name, path.join(PUBLIC, entry.name)]),
);

function serveStatic(req, res) {
  const pathname = req.url.split('?')[0];
  const name = pathname === '/' ? 'index.html' : pathname.slice(1);
  const file = FILES.get(name);
  if (!file) {
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
