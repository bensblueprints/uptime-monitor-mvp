import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'data', 'uptime.db');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS monitors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  interval_seconds INTEGER NOT NULL DEFAULT 60,
  expected_status INTEGER NOT NULL DEFAULT 0, -- 0 = any 2xx/3xx
  keyword TEXT,
  webhook_url TEXT,
  paused INTEGER NOT NULL DEFAULT 0,
  current_status TEXT NOT NULL DEFAULT 'pending', -- pending | up | down
  last_check_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
);

CREATE TABLE IF NOT EXISTS checks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  monitor_id INTEGER NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
  status TEXT NOT NULL,            -- up | down
  http_status INTEGER,
  response_ms INTEGER,
  error TEXT,
  checked_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_checks_monitor_time ON checks(monitor_id, checked_at);

CREATE TABLE IF NOT EXISTS incidents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  monitor_id INTEGER NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  cause TEXT
);
CREATE INDEX IF NOT EXISTS idx_incidents_monitor ON incidents(monitor_id, started_at);
`);

db.pragma('foreign_keys = ON');

const RETENTION_DAYS = parseInt(process.env.RETENTION_DAYS || '90', 10);

export function pruneOldData() {
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 3600 * 1000;
  const a = db.prepare('DELETE FROM checks WHERE checked_at < ?').run(cutoff);
  const b = db
    .prepare('DELETE FROM incidents WHERE ended_at IS NOT NULL AND ended_at < ?')
    .run(cutoff);
  return { checks: a.changes, incidents: b.changes };
}

export default db;
