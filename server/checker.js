import db from './db.js';
import { pruneOldData } from './db.js';
import { sendAlerts } from './alerts.js';

const CHECK_TIMEOUT_MS = parseInt(process.env.CHECK_TIMEOUT_MS || '10000', 10);
const TICK_MS = 5000;

const inFlight = new Set();

/** Perform one HTTP check against a monitor's URL. */
export async function performCheck(monitor) {
  const started = Date.now();
  let httpStatus = null;
  let error = null;
  let up = false;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);
  try {
    const res = await fetch(monitor.url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': 'UptimeMonitor/1.0 (+self-hosted)' }
    });
    httpStatus = res.status;
    if (monitor.expected_status && monitor.expected_status > 0) {
      up = res.status === monitor.expected_status;
      if (!up) error = `Expected HTTP ${monitor.expected_status}, got ${res.status}`;
    } else {
      up = res.status >= 200 && res.status < 400;
      if (!up) error = `HTTP ${res.status}`;
    }
    if (up && monitor.keyword) {
      const body = await res.text();
      if (!body.includes(monitor.keyword)) {
        up = false;
        error = `Keyword "${monitor.keyword}" not found in response`;
      }
    }
  } catch (err) {
    error = err.name === 'AbortError' ? `Timeout after ${CHECK_TIMEOUT_MS}ms` : err.message;
  } finally {
    clearTimeout(timer);
  }

  return {
    status: up ? 'up' : 'down',
    http_status: httpStatus,
    response_ms: Date.now() - started,
    error,
    checked_at: Date.now()
  };
}

/** Run a check for a monitor, persist the result, handle transitions + alerts. */
export async function checkMonitor(monitorId) {
  if (inFlight.has(monitorId)) return null;
  inFlight.add(monitorId);
  try {
    const monitor = db.prepare('SELECT * FROM monitors WHERE id = ?').get(monitorId);
    if (!monitor) return null;

    const check = await performCheck(monitor);

    db.prepare(
      `INSERT INTO checks (monitor_id, status, http_status, response_ms, error, checked_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(monitor.id, check.status, check.http_status, check.response_ms, check.error, check.checked_at);

    db.prepare('UPDATE monitors SET current_status = ?, last_check_at = ? WHERE id = ?').run(
      check.status,
      check.checked_at,
      monitor.id
    );

    const prev = monitor.current_status;
    let incident = null;

    if (check.status === 'down' && prev !== 'down') {
      // open incident
      incident = db
        .prepare('INSERT INTO incidents (monitor_id, started_at, cause) VALUES (?, ?, ?)')
        .run(monitor.id, check.checked_at, check.error || 'Unknown failure');
      if (prev === 'up') {
        sendAlerts({ type: 'down', monitor, check }).catch(() => {});
      }
      console.log(`[checker] ${monitor.name} DOWN: ${check.error}`);
    } else if (check.status === 'up' && prev === 'down') {
      db.prepare(
        'UPDATE incidents SET ended_at = ? WHERE monitor_id = ? AND ended_at IS NULL'
      ).run(check.checked_at, monitor.id);
      sendAlerts({ type: 'recovery', monitor, check }).catch(() => {});
      console.log(`[checker] ${monitor.name} RECOVERED (${check.response_ms}ms)`);
    }

    return check;
  } finally {
    inFlight.delete(monitorId);
  }
}

function tick() {
  const now = Date.now();
  const monitors = db
    .prepare('SELECT id, interval_seconds, last_check_at FROM monitors WHERE paused = 0')
    .all();
  for (const m of monitors) {
    const due = !m.last_check_at || now - m.last_check_at >= m.interval_seconds * 1000;
    if (due) checkMonitor(m.id).catch((err) => console.error('[checker]', err.message));
  }
}

let tickTimer = null;
let pruneTimer = null;

export function startScheduler() {
  if (tickTimer) return;
  pruneOldData();
  tickTimer = setInterval(tick, TICK_MS);
  pruneTimer = setInterval(() => {
    const pruned = pruneOldData();
    if (pruned.checks || pruned.incidents) {
      console.log(`[retention] pruned ${pruned.checks} checks, ${pruned.incidents} incidents`);
    }
  }, 6 * 3600 * 1000);
  console.log('[checker] scheduler started (5s tick)');
}

export function stopScheduler() {
  clearInterval(tickTimer);
  clearInterval(pruneTimer);
  tickTimer = null;
  pruneTimer = null;
}
