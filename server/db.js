/**
 * Opens the SQLite database and brings it up to date with numbered migrations
 * (tracked by PRAGMA user_version), then seeds the starter list into an empty database.
 */
const { DatabaseSync } = require('node:sqlite');

const hasColumn = (db, table, column) =>
  db
    .prepare(`PRAGMA table_info(${table})`)
    .all()
    .some((c) => c.name === column);

const addColumn = (db, table, column, definition) => {
  if (!hasColumn(db, table, column))
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
};

// Migration 1 creates the current schema. It also upgrades a database made by the old
// single-file server, which had the tables but not every column or table.
const migrations = [
  (db) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS items(id INTEGER PRIMARY KEY, kind TEXT, name TEXT, note TEXT, pmin INT, pmax INT, sort INT);
      CREATE TABLE IF NOT EXISTS entries(id INTEGER PRIMARY KEY, ts TEXT, day TEXT, item_id INT, kind TEXT, points INT, who TEXT, note TEXT, undone INT DEFAULT 0);
      CREATE TABLE IF NOT EXISTS rewards(id INTEGER PRIMARY KEY, name TEXT, stars INT, points INT);
      CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT);
      CREATE TABLE IF NOT EXISTS sessions(id INTEGER PRIMARY KEY, token_hash TEXT UNIQUE, role TEXT, device TEXT, created TEXT, last_seen TEXT);
    `);
    addColumn(db, 'items', 'active', 'INT DEFAULT 1');
    addColumn(db, 'rewards', 'sort', 'INT');
    db.exec('UPDATE rewards SET sort = id WHERE sort IS NULL');
  },
];

function migrate(db) {
  const current = db.prepare('PRAGMA user_version').get().user_version;
  migrations.forEach((run, i) => {
    const version = i + 1;
    if (version <= current) return;
    db.exec('BEGIN');
    try {
      run(db);
      db.exec(`PRAGMA user_version = ${version}`);
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  });
}

// Starter list for a new database; parents edit everything in Settings.
const TARGETS = [
  ['Morning routine done', 'per routine', 5, 5],
  ['Help with a family chore', 'points per chore', 5, 15],
  ['Tidy room', 'per day', 10, 10],
  ['Homework 30 min', '', 10, 10],
  ['Reading 20 min', '', 5, 5],
  ['Kind words or a kind gesture', 'per occasion', 5, 10],
  ['Practice an instrument or sport 15 min', '', 5, 5],
  ['Follow screen-time rules', 'per day', 5, 5],
  ['Use a calming strategy', 'when upset', 5, 5],
];
const PENALTIES = [
  ['Hitting or hurting someone', 'per incident'],
  ['Unkind or rude words', 'per incident'],
  ['Breaking screen-time rules', 'per incident'],
];
const CHALLENGES = ['Morning routine', 'Kind words', 'Homework', 'Bedtime on time'];
const REWARDS = [
  ['Pick the family movie', 2, 0],
  ['Choose dinner', 3, 0],
  ['Extra 30 min screen time', 2, 50],
  ['Trip to the park', 4, 100],
  ['New book', 6, 200],
  ['A special day out', 12, 500],
];

function seed(db) {
  if (db.prepare('SELECT 1 FROM items').get()) return;
  db.exec('BEGIN');
  const item = db.prepare('INSERT INTO items(kind,name,note,pmin,pmax,sort) VALUES(?,?,?,?,?,?)');
  let sort = 0;
  for (const [name, note, pmin, pmax] of TARGETS)
    item.run('target', name, note, pmin, pmax, sort++);
  for (const [name, note] of PENALTIES) item.run('penalty', name, note, 50, 50, sort++);
  for (const name of CHALLENGES) item.run('challenge', name, '', 0, 0, sort++);
  const reward = db.prepare('INSERT INTO rewards(name,stars,points) VALUES(?,?,?)');
  for (const [name, stars, points] of REWARDS) reward.run(name, stars, points);
  db.exec('COMMIT');
}

function open(path) {
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  migrate(db);
  seed(db);
  db.exec('UPDATE rewards SET sort = id WHERE sort IS NULL');
  return db;
}

module.exports = { open };
