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
  mp4: 'video/mp4',
  ico: 'image/x-icon',
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

/**
 * A video, with byte ranges (Safari asks for them before it plays): one range per request,
 * `bytes=a-b`, `bytes=a-` or `bytes=-n`; anything else unsatisfiable gets 416.
 */
function serveRanges(req, res, file, headers) {
  const size = fs.statSync(file).size;
  const all = { ...headers, 'Accept-Ranges': 'bytes', 'Cache-Control': 'public, max-age=3600' };
  const range = /^bytes=(\d*)-(\d*)$/.exec(String(req.headers.range || '').trim());
  let start = 0;
  let end = size - 1;
  let status = 200;
  if (req.headers.range) {
    if (range && (range[1] || range[2])) {
      if (range[1]) {
        start = Number(range[1]);
        if (range[2]) end = Math.min(Number(range[2]), size - 1);
      } else {
        start = Math.max(0, size - Number(range[2]));
      }
    }
    if (!range || (!range[1] && !range[2]) || start > end || start >= size) {
      res.writeHead(416, { ...all, 'Content-Range': `bytes */${size}` });
      return res.end();
    }
    status = 206;
    all['Content-Range'] = `bytes ${start}-${end}/${size}`;
  }
  res.writeHead(status, { ...all, 'Content-Length': String(end - start + 1) });
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(file, { start, end }).pipe(res);
}

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
  if (ext === 'mp4') return serveRanges(req, res, file, headers);
  // The page's own files: a browser may keep them, but checks for a newer one first, so an
  // update shows on the next load instead of mixing old scripts with a new server.
  headers['Cache-Control'] = 'no-cache';
  res.writeHead(200, headers);
  res.end(fs.readFileSync(file));
}

module.exports = { serveStatic };
