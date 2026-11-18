/**
 * The bot's small state, kept in one JSON file on the data volume so a restart doesn't forget a
 * new member halfway through the check: pending checks and issue drafts. No message text is kept
 * beyond a draft's own summary, and drafts expire after a day.
 */
const fs = require('node:fs');
const path = require('node:path');

function createStore(dir) {
  const file = dir ? path.join(dir, 'state.json') : null;
  let state = { pending: {}, drafts: {} };
  if (file) {
    try {
      state = { ...state, ...JSON.parse(fs.readFileSync(file, 'utf8')) };
    } catch {}
  }
  function save() {
    if (!file) return;
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(state));
    fs.renameSync(tmp, file);
  }
  return { state, save };
}

module.exports = { createStore };
