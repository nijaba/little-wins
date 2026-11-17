/** HTTP helpers: JSON replies, request bodies limited to 10 KB, and the guard on writes. */
const config = require('./config');
const messages = require('./messages');

/** Sends `payload` as JSON with the given status and extra headers. */
function sendJson(res, status, payload, headers = {}) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...headers,
  });
  res.end(JSON.stringify(payload));
}

/**
 * The body of an API error: the English text, plus the message key as a stable `code` and any
 * parameters (e.g. { seconds }), so the page can show it in the family's language.
 */
function apiError(code, params = {}) {
  const m = messages[code];
  return { error: typeof m === 'function' ? m(...Object.values(params)) : m, code, ...params };
}

/**
 * Reads a JSON body. Resolves to null when it is over the limit (the rest is discarded
 * unread), and to {} when it is empty or not valid JSON.
 */
const readBody = (req) =>
  new Promise((resolve) => {
    if (+req.headers['content-length'] > config.maxBody) {
      req.resume();
      return resolve(null);
    }
    let text = '';
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > config.maxBody) {
        req.removeAllListeners('data');
        req.resume();
        resolve(null);
      } else {
        text += chunk;
      }
    });
    req.on('end', () => {
      if (size > config.maxBody) return;
      try {
        resolve(JSON.parse(text || '{}'));
      } catch {
        resolve({});
      }
    });
  });

/**
 * Writes must be JSON and must not come from another site: a foreign `Origin`, or
 * `Sec-Fetch-Site: cross-site`, is refused. Returns null when fine, else [status, key].
 */
function checkWrite(req) {
  const type = String(req.headers['content-type'] || '');
  if (!type.startsWith('application/json')) return [415, 'jsonOnly'];
  const origin = req.headers.origin;
  if (origin && origin !== config.origin) return [403, 'foreignOrigin'];
  if (req.headers['sec-fetch-site'] === 'cross-site') return [403, 'foreignOrigin'];
  return null;
}

module.exports = { sendJson, readBody, checkWrite, apiError };
