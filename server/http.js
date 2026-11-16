/** HTTP helpers: JSON replies and request bodies limited to 10 KB. */
const config = require('./config');

/** Sends `payload` as JSON with the given status and extra headers. */
function sendJson(res, status, payload, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json', ...headers });
  res.end(JSON.stringify(payload));
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

module.exports = { sendJson, readBody };
