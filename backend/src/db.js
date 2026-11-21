const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const { DB_FILE } = require('./config');

fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
const db = new Database(DB_FILE);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  first_name    TEXT NOT NULL DEFAULT '',
  last_name     TEXT NOT NULL DEFAULT '',
  country       TEXT NOT NULL DEFAULT 'Tunisia',
  phone         TEXT NOT NULL DEFAULT '',
  street        TEXT NOT NULL DEFAULT '',
  line2         TEXT NOT NULL DEFAULT '',
  city          TEXT NOT NULL DEFAULT '',
  area          TEXT NOT NULL DEFAULT '',
  state         TEXT NOT NULL DEFAULT '',
  zip           TEXT NOT NULL DEFAULT '',
  bio           TEXT NOT NULL DEFAULT '',   -- short public description (social profile)
  avatar        TEXT,                       -- /uploads/<file> or NULL
  lat           REAL,
  lng           REAL,
  -- Rating aggregate (seed users start with a history; real ratings add to it)
  rating_sum    INTEGER NOT NULL DEFAULT 0,
  rating_count  INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS items (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category    TEXT NOT NULL CHECK (category IN ('Tools','Outdoor','Bikes','Electronics','Party gear')),
  price       REAL NOT NULL DEFAULT 0 CHECK (price >= 0),
  condition   TEXT NOT NULL DEFAULT 'Good',
  image       TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_items_owner ON items(owner_id);
CREATE INDEX IF NOT EXISTS idx_items_category ON items(category);

CREATE TABLE IF NOT EXISTS requests (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id     INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  borrower_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date_from   TEXT NOT NULL,   -- YYYY-MM-DD
  date_to     TEXT NOT NULL,   -- YYYY-MM-DD
  note        TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined','returned')),
  total_price REAL NOT NULL DEFAULT 0,
  returned_at TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_requests_item ON requests(item_id);
CREATE INDEX IF NOT EXISTS idx_requests_borrower ON requests(borrower_id);

CREATE TABLE IF NOT EXISTS ratings (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id INTEGER NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  rater_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ratee_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  score      INTEGER NOT NULL CHECK (score BETWEEN 1 AND 10),
  comment    TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (request_id, rater_id)
);
`);

// Migration for databases created before bio/avatar existed (CREATE TABLE IF NOT EXISTS won't add columns).
const userCols = db.prepare('PRAGMA table_info(users)').all().map((c) => c.name);
if (!userCols.includes('bio')) db.exec("ALTER TABLE users ADD COLUMN bio TEXT NOT NULL DEFAULT ''");
if (!userCols.includes('avatar')) db.exec('ALTER TABLE users ADD COLUMN avatar TEXT');

module.exports = db;
