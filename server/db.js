/**
 * Opens the SQLite database and brings it up to date with numbered migrations
 * (tracked by PRAGMA user_version). Also holds the starter list a new family can start with.
 */
const { DatabaseSync } = require('node:sqlite');

const hasColumn = (db, table, column) =>
  db
    .prepare(`PRAGMA table_info(${table})`)
    .all()
    .some((c) => c.name === column);

const hasTable = (db, table) =>
  !!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table);

const addColumn = (db, table, column, definition) => {
  if (!hasColumn(db, table, column))
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
};

/** The server's own time zone, used only to place data migrated from a single-family install. */
const serverTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

const migrations = [
  // 1: the single-family schema. Also upgrades a database made by the earliest single-file
  // server, which had the tables but not every column or table.
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

  // 2: families, parents (users and memberships), children, invites and device pairings.
  // Every table gets a family_id. Existing single-family data becomes one family with one
  // child and no parents yet: the first parent allowed to create a family claims it.
  // Old PIN sessions are dropped: everyone signs in again.
  (db) => {
    db.exec(`
      CREATE TABLE families(id INTEGER PRIMARY KEY, name TEXT NOT NULL, timezone TEXT NOT NULL DEFAULT 'UTC',
        week_start INT NOT NULL DEFAULT 1, created TEXT NOT NULL);
      CREATE TABLE users(id INTEGER PRIMARY KEY, provider TEXT NOT NULL, subject TEXT NOT NULL, email TEXT, login TEXT,
        name TEXT NOT NULL, created TEXT NOT NULL, last_seen TEXT NOT NULL, UNIQUE(provider, subject));
      CREATE TABLE memberships(family_id INT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
        user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE, role TEXT NOT NULL, created TEXT NOT NULL,
        PRIMARY KEY(family_id, user_id));
      CREATE UNIQUE INDEX memberships_one_family_per_user ON memberships(user_id);
      CREATE TABLE children(id INTEGER PRIMARY KEY, family_id INT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
        name TEXT NOT NULL, sort INT NOT NULL DEFAULT 0, created TEXT NOT NULL);
      CREATE TABLE invites(id INTEGER PRIMARY KEY, family_id INT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
        token_hash TEXT NOT NULL UNIQUE, created_by INT, created TEXT NOT NULL, expires TEXT NOT NULL, used_at TEXT);
      CREATE TABLE pairings(id INTEGER PRIMARY KEY, family_id INT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
        child_id INT NOT NULL REFERENCES children(id) ON DELETE CASCADE, code_hash TEXT NOT NULL UNIQUE,
        created_by INT, created TEXT NOT NULL, expires TEXT NOT NULL, used_at TEXT);
      DROP TABLE IF EXISTS sessions;
      CREATE TABLE sessions(id INTEGER PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE,
        family_id INT REFERENCES families(id) ON DELETE CASCADE, kind TEXT NOT NULL,
        user_id INT REFERENCES users(id) ON DELETE CASCADE, child_id INT REFERENCES children(id) ON DELETE CASCADE,
        device TEXT, created TEXT NOT NULL, last_seen TEXT NOT NULL);
    `);
    addColumn(db, 'items', 'family_id', 'INT REFERENCES families(id) ON DELETE CASCADE');
    addColumn(db, 'rewards', 'family_id', 'INT REFERENCES families(id) ON DELETE CASCADE');
    addColumn(db, 'entries', 'family_id', 'INT REFERENCES families(id) ON DELETE CASCADE');
    addColumn(db, 'entries', 'child_id', 'INT REFERENCES children(id) ON DELETE CASCADE');
    addColumn(db, 'entries', 'user_id', 'INT');

    const hasData = ['items', 'entries', 'rewards'].some((t) =>
      db.prepare(`SELECT 1 FROM ${t} LIMIT 1`).get(),
    );
    if (hasData) {
      const now = new Date().toISOString();
      const setting = hasTable(db, 'settings')
        ? db.prepare("SELECT value FROM settings WHERE key='child_name'").get()
        : null;
      const familyId = Number(
        db
          .prepare('INSERT INTO families(name,timezone,week_start,created) VALUES(?,?,1,?)')
          .run('Our family', serverTimeZone(), now).lastInsertRowid,
      );
      const childId = Number(
        db
          .prepare('INSERT INTO children(family_id,name,sort,created) VALUES(?,?,0,?)')
          .run(familyId, setting?.value?.trim() || 'Child', now).lastInsertRowid,
      );
      db.prepare('UPDATE items SET family_id=?').run(familyId);
      db.prepare('UPDATE rewards SET family_id=?').run(familyId);
      db.prepare('UPDATE entries SET family_id=?, child_id=?').run(familyId, childId);
    }
    db.exec(`
      DROP TABLE IF EXISTS settings;
      CREATE INDEX items_family ON items(family_id, kind, sort);
      CREATE INDEX rewards_family ON rewards(family_id, sort);
      CREATE INDEX entries_child_day ON entries(family_id, child_id, day);
      CREATE INDEX children_family ON children(family_id, sort);
      CREATE INDEX sessions_family ON sessions(family_id);
      CREATE INDEX invites_family ON invites(family_id);
      CREATE INDEX pairings_family ON pairings(family_id);
    `);
  },

  // 3: a version per family, bumped on every change, so an unchanged state can answer
  // 304 Not Modified; and the Google Workspace domain, so allowlists can be checked later.
  (db) => {
    addColumn(db, 'families', 'version', 'INT NOT NULL DEFAULT 0');
    addColumn(db, 'users', 'domain', 'TEXT');
  },

  // 4: each family's language (en, zh, es, fr, de).
  (db) => {
    addColumn(db, 'families', 'language', "TEXT NOT NULL DEFAULT 'en'");
  },

  // 5: family invites, issued by an operator (SIGNUP_MODE=invite). Installation-wide, so no
  // family_id of their own: family_id is the family the invited parent created, once they have.
  (db) => {
    db.exec(`
      CREATE TABLE family_invites(id INTEGER PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE, created_by INT,
        created TEXT NOT NULL, expires TEXT NOT NULL,
        used_by INT REFERENCES users(id) ON DELETE CASCADE, used_at TEXT,
        family_id INT REFERENCES families(id) ON DELETE SET NULL);
    `);
  },

  // 6: when each family last used the app (any of its devices), so idle families can be
  // deleted (DELETE_IDLE_FAMILIES_DAYS). Starts at the latest device use, or the family's creation.
  (db) => {
    addColumn(db, 'families', 'last_active', 'TEXT');
    db.exec(`UPDATE families SET last_active = COALESCE(
      (SELECT MAX(s.last_seen) FROM sessions s WHERE s.family_id = families.id), created)`);
  },

  // 7: a parent's encouraging message to a child, shown on the child's Today (one per child).
  (db) => {
    db.exec(`
      CREATE TABLE messages(child_id INTEGER PRIMARY KEY REFERENCES children(id) ON DELETE CASCADE,
        family_id INT NOT NULL REFERENCES families(id) ON DELETE CASCADE, text TEXT NOT NULL,
        user_id INT, who TEXT NOT NULL, created TEXT NOT NULL);
    `);
  },

  // 8: behaviors, penalties, challenges and rewards for some children only. for_all=1 (the
  // default, and every existing row) means every child; otherwise the link table names them.
  (db) => {
    addColumn(db, 'items', 'for_all', 'INT NOT NULL DEFAULT 1');
    addColumn(db, 'rewards', 'for_all', 'INT NOT NULL DEFAULT 1');
    db.exec(`
      CREATE TABLE item_children(item_id INT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
        child_id INT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
        family_id INT NOT NULL REFERENCES families(id) ON DELETE CASCADE, PRIMARY KEY(item_id, child_id));
      CREATE TABLE reward_children(reward_id INT NOT NULL REFERENCES rewards(id) ON DELETE CASCADE,
        child_id INT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
        family_id INT NOT NULL REFERENCES families(id) ON DELETE CASCADE, PRIMARY KEY(reward_id, child_id));
    `);
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

const i18n = require('./i18n');

/** Adds the starter list, in the family's language, to a family. The caller runs it in a transaction. */
function seedStarter(db, familyId, lang = 'en') {
  const names = i18n.starter(lang);
  const pts = i18n.STARTER_POINTS;
  const item = db.prepare(
    'INSERT INTO items(family_id,kind,name,note,pmin,pmax,sort,active) VALUES(?,?,?,?,?,?,?,1)',
  );
  let sort = 0;
  names.targets.forEach(([name, note], i) => {
    item.run(familyId, 'target', name, note, pts.targets[i][0], pts.targets[i][1], sort++);
  });
  for (const [name, note] of names.penalties) {
    item.run(familyId, 'penalty', name, note, pts.penalty, pts.penalty, sort++);
  }
  for (const name of names.challenges) item.run(familyId, 'challenge', name, '', 0, 0, sort++);
  const reward = db.prepare(
    'INSERT INTO rewards(family_id,name,stars,points,sort) VALUES(?,?,?,?,?)',
  );
  names.rewards.forEach((name, i) => {
    reward.run(familyId, name, pts.rewards[i][0], pts.rewards[i][1], i + 1);
  });
}

function open(path) {
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  migrate(db);
  return db;
}

module.exports = {
  open,
  seedStarter,
  starterCounts: {
    targets: i18n.STARTER_POINTS.targets.length,
    penalties: 3,
    challenges: 4,
    rewards: i18n.STARTER_POINTS.rewards.length,
  },
};
