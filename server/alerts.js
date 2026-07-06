import nodemailer from 'nodemailer';

let transporter = null;

function getTransporter() {
  if (!process.env.SMTP_HOST) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined
    });
  }
  return transporter;
}

async function sendWebhook(url, payload) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
  } finally {
    clearTimeout(timer);
  }
}

async function sendEmail(subject, text) {
  const t = getTransporter();
  const to = process.env.ALERT_EMAIL_TO;
  if (!t || !to) return;
  await t.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER || 'uptime-monitor@localhost',
    to,
    subject,
    text
  });
}

/**
 * Fire down/recovery alerts. Never throws — alerting must not break the checker.
 * event: { type: 'down' | 'recovery', monitor, check, incident }
 */
export async function sendAlerts(event) {
  const { type, monitor, check } = event;
  const emoji = type === 'down' ? '🔴' : '🟢';
  const verb = type === 'down' ? 'is DOWN' : 'has RECOVERED';
  const subject = `${emoji} ${monitor.name} ${verb}`;
  const detail =
    type === 'down'
      ? `Reason: ${check.error || `HTTP ${check.http_status}`}`
      : `Response time: ${check.response_ms}ms`;
  const text = `${monitor.name} (${monitor.url}) ${verb} at ${new Date(
    check.checked_at
  ).toISOString()}\n${detail}`;

  const payload = {
    event: type,
    monitor: { id: monitor.id, name: monitor.name, url: monitor.url },
    check: {
      status: check.status,
      http_status: check.http_status,
      response_ms: check.response_ms,
      error: check.error,
      checked_at: check.checked_at
    },
    message: text
  };

  const webhooks = [monitor.webhook_url, process.env.ALERT_WEBHOOK_URL].filter(Boolean);
  const jobs = webhooks.map((url) =>
    sendWebhook(url, payload).catch((err) =>
      console.error(`[alerts] webhook failed (${url}):`, err.message)
    )
  );
  jobs.push(
    sendEmail(subject, text).catch((err) =>
      console.error('[alerts] email failed:', err.message)
    )
  );
  await Promise.all(jobs);
}
