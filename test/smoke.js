// Smoke test: boots the real server, creates a monitor against a local target,
// forces check cycles, and asserts UP -> DOWN transition lands in SQLite.
import { spawn } from 'node:child_process';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import assert from 'node:assert';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const TEST_PORT = 5391;
const TARGET_PORT = 5392;
const ADMIN_PASSWORD = 'smoke-test-password';
const DB_PATH = path.join(__dirname, 'smoke.db');
const BASE = `http://127.0.0.1:${TEST_PORT}`;

for (const f of [DB_PATH, DB_PATH + '-wal', DB_PATH + '-shm']) {
  if (fs.existsSync(f)) fs.unlinkSync(f);
}

let serverProc = null;
let target = null;

function startTarget() {
  return new Promise((resolve) => {
    target = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<html><body>hello smoke keyword-alive</body></html>');
    });
    target.listen(TARGET_PORT, '127.0.0.1', resolve);
  });
}

function stopTarget() {
  return new Promise((resolve) => {
    target.close(resolve);
    target.closeAllConnections?.();
  });
}

async function waitFor(fn, label, tries = 40, delay = 250) {
  for (let i = 0; i < tries; i++) {
    try {
      const v = await fn();
      if (v) return v;
    } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, delay));
  }
  throw new Error(`Timed out waiting for: ${label}`);
}

let cookie = '';
async function api(pathname, options = {}) {
  const res = await fetch(BASE + pathname, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { Cookie: cookie } : {}),
      ...options.headers
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0];
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function main() {
  console.log('1. Starting local test target on port', TARGET_PORT);
  await startTarget();

  console.log('2. Starting Uptime Monitor server on port', TEST_PORT);
  serverProc = spawn(process.execPath, ['server/index.js'], {
    cwd: ROOT,
    env: {
      ...process.env,
      PORT: String(TEST_PORT),
      ADMIN_PASSWORD,
      DB_PATH,
      AUTH_DISABLED: 'false'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  serverProc.stdout.on('data', (d) => process.stdout.write(`   [server] ${d}`));
  serverProc.stderr.on('data', (d) => process.stderr.write(`   [server] ${d}`));

  await waitFor(async () => (await api('/api/health')).data.ok, 'server health');

  console.log('3. Auth: wrong password rejected, right password accepted');
  const bad = await api('/api/login', { method: 'POST', body: { password: 'wrong' } });
  assert.strictEqual(bad.status, 401, 'wrong password must 401');
  cookie = '';
  const unauth = await api('/api/monitors');
  assert.strictEqual(unauth.status, 401, 'admin API must require auth');
  const good = await api('/api/login', { method: 'POST', body: { password: ADMIN_PASSWORD } });
  assert.strictEqual(good.status, 200, 'login must succeed');

  console.log('4. Creating monitor pointing at the test target');
  const created = await api('/api/monitors', {
    method: 'POST',
    body: {
      name: 'Smoke Target',
      url: `http://127.0.0.1:${TARGET_PORT}/`,
      interval_seconds: 30,
      keyword: 'keyword-alive'
    }
  });
  assert.strictEqual(created.status, 201, 'monitor create must 201');
  const monitorId = created.data.id;

  console.log('5. Forcing a check cycle — expecting UP');
  const forced = await api(`/api/monitors/${monitorId}/check`, { method: 'POST' });
  assert.strictEqual(forced.status, 200);
  // forced check may be skipped if the create-time check is still in flight
  await waitFor(async () => {
    const list = await api('/api/monitors');
    return list.data.find((m) => m.id === monitorId)?.current_status === 'up';
  }, 'monitor UP');

  // Assert a check row actually landed in SQLite
  const { default: Database } = await import('better-sqlite3');
  const db = new Database(DB_PATH, { readonly: true });
  const upRow = db
    .prepare("SELECT * FROM checks WHERE monitor_id = ? AND status = 'up'")
    .get(monitorId);
  assert.ok(upRow, 'an UP check row must exist in SQLite');
  assert.ok(upRow.response_ms >= 0, 'check row must record response_ms');
  assert.strictEqual(upRow.http_status, 200);
  console.log(`   UP check row in SQLite: http ${upRow.http_status}, ${upRow.response_ms}ms`);

  console.log('6. Status API reflects UP');
  const pub1 = await fetch(BASE + '/api/public/status').then((r) => r.json());
  const pubMon1 = pub1.monitors.find((m) => m.id === monitorId);
  assert.strictEqual(pubMon1.status, 'up', 'public status API must show up');
  assert.strictEqual(pub1.overall, 'operational');

  console.log('7. Killing test target, forcing check — expecting DOWN transition');
  await stopTarget();
  const forced2 = await api(`/api/monitors/${monitorId}/check`, { method: 'POST' });
  assert.strictEqual(forced2.status, 200);
  assert.strictEqual(forced2.data.check.status, 'down', 'forced check must be down');

  const downRow = db
    .prepare("SELECT * FROM checks WHERE monitor_id = ? AND status = 'down'")
    .get(monitorId);
  assert.ok(downRow, 'a DOWN check row must exist in SQLite');

  const incident = db
    .prepare('SELECT * FROM incidents WHERE monitor_id = ? AND ended_at IS NULL')
    .get(monitorId);
  assert.ok(incident, 'an open incident row must exist after DOWN transition');
  console.log(`   Incident opened: "${incident.cause}"`);

  const pub2 = await fetch(BASE + '/api/public/status').then((r) => r.json());
  const pubMon2 = pub2.monitors.find((m) => m.id === monitorId);
  assert.strictEqual(pubMon2.status, 'down', 'public status API must show down');
  assert.strictEqual(pub2.overall, 'major_outage');

  console.log('8. Restarting target, forcing check — expecting RECOVERY + incident closed');
  await startTarget();
  await api(`/api/monitors/${monitorId}/check`, { method: 'POST' });
  const closed = db
    .prepare('SELECT * FROM incidents WHERE monitor_id = ? AND ended_at IS NOT NULL')
    .get(monitorId);
  assert.ok(closed, 'incident must be closed after recovery');

  console.log('9. Detail API returns uptime windows + incident log');
  const detail = await api(`/api/monitors/${monitorId}/detail`);
  assert.ok(detail.data.uptime['24h'] !== null, 'uptime 24h computed');
  assert.ok(detail.data.incidents.length >= 1, 'incident log populated');
  assert.strictEqual(detail.data.bars.length, 90, '90-day bars returned');

  db.close();
  console.log('\nSMOKE TEST PASSED ✔  (up check, down transition, incident, recovery, status API)');
}

main()
  .then(() => cleanup(0))
  .catch((err) => {
    console.error('\nSMOKE TEST FAILED ✖');
    console.error(err);
    cleanup(1);
  });

function cleanup(code) {
  try { serverProc?.kill(); } catch { /* ignore */ }
  try { target?.close(); } catch { /* ignore */ }
  setTimeout(() => {
    for (const f of [DB_PATH, DB_PATH + '-wal', DB_PATH + '-shm']) {
      try { fs.unlinkSync(f); } catch { /* ignore */ }
    }
    process.exit(code);
  }, 300);
}
