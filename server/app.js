import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import db from './db.js';
import { checkMonitor } from './checker.js';
import {
  requireAuth,
  isAuthed,
  checkPassword,
  createSession,
  destroySession,
  COOKIE_NAME
} from './auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.join(__dirname, '..', 'dist');

const MIN_INTERVAL = 30;
const MAX_INTERVAL = 900;
const DAY = 24 * 3600 * 1000;

function uptimePct(monitorId, sinceMs) {
  const row = db
    .prepare(
      `SELECT COUNT(*) AS total, SUM(CASE WHEN status = 'up' THEN 1 ELSE 0 END) AS up
       FROM checks WHERE monitor_id = ? AND checked_at >= ?`
    )
    .get(monitorId, Date.now() - sinceMs);
  if (!row.total) return null;
  return Math.round((row.up / row.total) * 10000) / 100;
}

function dailyBars(monitorId, days = 90) {
  const since = Date.now() - days * DAY;
  const rows = db
    .prepare(
      `SELECT date(checked_at / 1000, 'unixepoch') AS day,
              COUNT(*) AS total,
              SUM(CASE WHEN status = 'up' THEN 1 ELSE 0 END) AS up
       FROM checks WHERE monitor_id = ? AND checked_at >= ?
       GROUP BY day ORDER BY day`
    )
    .all(monitorId, since);
  const byDay = new Map(rows.map((r) => [r.day, r]));
  const bars = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * DAY).toISOString().slice(0, 10);
    const r = byDay.get(d);
    bars.push({
      date: d,
      pct: r ? Math.round((r.up / r.total) * 10000) / 100 : null
    });
  }
  return bars;
}

function validateMonitorInput(body, partial = false) {
  const errors = [];
  const out = {};
  if (!partial || body.name !== undefined) {
    if (!body.name || typeof body.name !== 'string' || !body.name.trim())
      errors.push('name is required');
    else out.name = body.name.trim();
  }
  if (!partial || body.url !== undefined) {
    try {
      const u = new URL(body.url);
      if (!['http:', 'https:'].includes(u.protocol)) throw new Error();
      out.url = body.url;
    } catch {
      errors.push('url must be a valid http(s) URL');
    }
  }
  if (body.interval_seconds !== undefined) {
    const iv = parseInt(body.interval_seconds, 10);
    if (!Number.isFinite(iv) || iv < MIN_INTERVAL || iv > MAX_INTERVAL)
      errors.push(`interval_seconds must be ${MIN_INTERVAL}-${MAX_INTERVAL}`);
    else out.interval_seconds = iv;
  }
  if (body.expected_status !== undefined) {
    const es = parseInt(body.expected_status || 0, 10);
    if (!Number.isFinite(es) || es < 0 || es > 599) errors.push('expected_status invalid');
    else out.expected_status = es;
  }
  if (body.keyword !== undefined) out.keyword = body.keyword ? String(body.keyword) : null;
  if (body.webhook_url !== undefined)
    out.webhook_url = body.webhook_url ? String(body.webhook_url) : null;
  return { errors, out };
}

export function createApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());

  // ---------- Auth ----------
  app.post('/api/login', (req, res) => {
    if (!checkPassword(req.body?.password)) {
      return res.status(401).json({ error: 'Wrong password' });
    }
    const token = createSession();
    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 7 * 24 * 3600 * 1000
    });
    res.json({ ok: true });
  });

  app.post('/api/logout', (req, res) => {
    destroySession(req.cookies?.[COOKIE_NAME]);
    res.clearCookie(COOKIE_NAME);
    res.json({ ok: true });
  });

  app.get('/api/me', (req, res) => {
    res.json({ authed: isAuthed(req) });
  });

  // ---------- Admin: monitors ----------
  app.get('/api/monitors', requireAuth, (req, res) => {
    const monitors = db.prepare('SELECT * FROM monitors ORDER BY created_at').all();
    res.json(
      monitors.map((m) => ({
        ...m,
        uptime_24h: uptimePct(m.id, DAY),
        last_response_ms: db
          .prepare(
            'SELECT response_ms FROM checks WHERE monitor_id = ? ORDER BY checked_at DESC LIMIT 1'
          )
          .get(m.id)?.response_ms ?? null
      }))
    );
  });

  app.post('/api/monitors', requireAuth, (req, res) => {
    const { errors, out } = validateMonitorInput(req.body || {});
    if (errors.length) return res.status(400).json({ error: errors.join('; ') });
    const info = db
      .prepare(
        `INSERT INTO monitors (name, url, interval_seconds, expected_status, keyword, webhook_url)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        out.name,
        out.url,
        out.interval_seconds ?? 60,
        out.expected_status ?? 0,
        out.keyword ?? null,
        out.webhook_url ?? null
      );
    const monitor = db.prepare('SELECT * FROM monitors WHERE id = ?').get(info.lastInsertRowid);
    // kick off an immediate first check (async, non-blocking)
    checkMonitor(monitor.id).catch(() => {});
    res.status(201).json(monitor);
  });

  app.patch('/api/monitors/:id', requireAuth, (req, res) => {
    const monitor = db.prepare('SELECT * FROM monitors WHERE id = ?').get(req.params.id);
    if (!monitor) return res.status(404).json({ error: 'Not found' });
    const body = req.body || {};
    const { errors, out } = validateMonitorInput(body, true);
    if (errors.length) return res.status(400).json({ error: errors.join('; ') });
    if (body.paused !== undefined) out.paused = body.paused ? 1 : 0;
    const keys = Object.keys(out);
    if (keys.length) {
      const sets = keys.map((k) => `${k} = ?`).join(', ');
      db.prepare(`UPDATE monitors SET ${sets} WHERE id = ?`).run(
        ...keys.map((k) => out[k]),
        monitor.id
      );
    }
    res.json(db.prepare('SELECT * FROM monitors WHERE id = ?').get(monitor.id));
  });

  app.delete('/api/monitors/:id', requireAuth, (req, res) => {
    const info = db.prepare('DELETE FROM monitors WHERE id = ?').run(req.params.id);
    if (!info.changes) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  });

  // Force an immediate check (used by UI "Check now" + smoke test)
  app.post('/api/monitors/:id/check', requireAuth, async (req, res) => {
    const monitor = db.prepare('SELECT * FROM monitors WHERE id = ?').get(req.params.id);
    if (!monitor) return res.status(404).json({ error: 'Not found' });
    const check = await checkMonitor(monitor.id);
    res.json({ ok: true, check });
  });

  // Per-monitor detail: uptime windows, recent checks, incidents
  app.get('/api/monitors/:id/detail', requireAuth, (req, res) => {
    const monitor = db.prepare('SELECT * FROM monitors WHERE id = ?').get(req.params.id);
    if (!monitor) return res.status(404).json({ error: 'Not found' });
    const checks = db
      .prepare(
        `SELECT status, http_status, response_ms, error, checked_at
         FROM checks WHERE monitor_id = ? ORDER BY checked_at DESC LIMIT 100`
      )
      .all(monitor.id)
      .reverse();
    const incidents = db
      .prepare(
        'SELECT * FROM incidents WHERE monitor_id = ? ORDER BY started_at DESC LIMIT 50'
      )
      .all(monitor.id);
    res.json({
      monitor,
      uptime: {
        '24h': uptimePct(monitor.id, DAY),
        '7d': uptimePct(monitor.id, 7 * DAY),
        '30d': uptimePct(monitor.id, 30 * DAY)
      },
      checks,
      incidents,
      bars: dailyBars(monitor.id)
    });
  });

  // ---------- Public status page API (no auth) ----------
  app.get('/api/public/status', (req, res) => {
    const monitors = db
      .prepare('SELECT id, name, current_status, last_check_at FROM monitors WHERE paused = 0 ORDER BY created_at')
      .all();
    const items = monitors.map((m) => ({
      id: m.id,
      name: m.name,
      status: m.current_status,
      last_check_at: m.last_check_at,
      uptime_90d: uptimePct(m.id, 90 * DAY),
      bars: dailyBars(m.id)
    }));
    const downCount = items.filter((m) => m.status === 'down').length;
    const overall =
      items.length === 0 || downCount === 0
        ? 'operational'
        : downCount === items.length
          ? 'major_outage'
          : 'partial_outage';
    res.json({
      overall,
      name: process.env.STATUS_PAGE_NAME || 'Service Status',
      updated_at: Date.now(),
      monitors: items
    });
  });

  app.get('/api/health', (req, res) => res.json({ ok: true }));

  // ---------- Static frontend (SPA) ----------
  if (fs.existsSync(DIST_DIR)) {
    app.use(express.static(DIST_DIR));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) return next();
      res.sendFile(path.join(DIST_DIR, 'index.html'));
    });
  }

  return app;
}
