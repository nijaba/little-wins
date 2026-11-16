// Keeps docs/test-plan.md and the test names in step.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ID = /[A-Z]{2,3}-\d{2}/;
const plan = fs.readFileSync(path.join(__dirname, '..', 'docs', 'test-plan.md'), 'utf8');

/** Plan rows: id -> level. */
const rows = new Map();
for (const m of plan.matchAll(/^\| ([A-Z]{2,3}-\d{2}) \|.*\| (\w+) \|$/gm)) rows.set(m[1], m[2]);

/** Leading IDs of every test name in test/*.test.js (except this file). */
const used = new Set();
for (const f of fs.readdirSync(__dirname)) {
  if (!f.endsWith('.test.js') || f === 'test-plan.test.js') continue;
  const src = fs.readFileSync(path.join(__dirname, f), 'utf8');
  for (const m of src.matchAll(/\b(?:test|it)\(\s*(['"`])((?:[A-Z]{2,3}-\d{2}\s+)*)/g))
    for (const id of m[2].match(new RegExp(ID, 'g')) || []) used.add(id);
}

test('the plan has rows, and no ID appears twice', () => {
  assert.ok(rows.size > 100);
  const all = [...plan.matchAll(/^\| ([A-Z]{2,3}-\d{2}) \|/gm)].map((m) => m[1]);
  assert.equal(new Set(all).size, all.length);
});

test('every API, Unit and Image ID in the plan appears in a test name', () => {
  const missing = [...rows].filter(([id, lvl]) => /^(API|Unit|Image)$/.test(lvl) && !used.has(id));
  assert.deepEqual(
    missing.map(([id]) => id),
    [],
  );
});

test('every ID used in a test name exists in the plan', () => {
  const unknown = [...used].filter((id) => !rows.has(id) && !id.startsWith('E2E-'));
  assert.deepEqual(unknown, []);
});
