# Product Hunt Launch — Uptime Monitor

## Name
Uptime Monitor — pay once, monitor forever

## Tagline (60 chars)
Self-hosted uptime monitoring + status page. $39, no sub.

## Description (260 chars)
UptimeRobot charges $96/yr. Pingdom more. Uptime Monitor is the same thing on your own $5 VPS: unlimited HTTP monitors, 30s checks, keyword match, webhook + email alerts, and a beautiful public status page with 90-day bars. MIT source. Pay once, own it forever.

## Full description

Every agency I know pays a monthly tax just to know their client sites are up. The tools are great — but you're renting a ping loop and a status page, forever, with monitor caps designed to push you up a tier.

Uptime Monitor is that product as a one-time purchase:

- **Unlimited HTTP(S) monitors** with 30s–15m intervals, expected-status and keyword checks
- **Public status page** at /status — the classic 90-day uptime bars your clients recognize, branded with your name, no auth, no upsell
- **Down + recovery alerts** via webhook (Slack/Discord) and your own SMTP
- **Per-monitor detail** — 24h/7d/30d uptime, response-time sparkline, full incident log
- **One Node process + SQLite** — runs on the cheapest VPS you can find, or as a desktop app (Electron wrapper included)
- **MIT source** — audit it, fork it, it's yours

$39 once. UptimeRobot's paid plan costs that every 5 months.

## Maker first comment

Hey PH 👋

I run sites for clients, and every month a little invoice went out to an uptime service. It never sat right — the product is a loop that fetches URLs and a page with green bars. I was paying rent on a for-loop.

So I built the version you own. One Node process, SQLite file, checker loop in-process (no Redis, no workers), a public status page your clients can bookmark, and alerts to Slack or email when something dies. It runs on a $5 VPS next to everything else, or as a desktop app if you don't want a server at all.

Honest limits: HTTP(S) checks only right now (no ICMP/TCP/DNS yet), single admin user, and alerting is webhook + SMTP — that covers Slack, Discord, and email, which is what I actually use. Source is MIT on GitHub; the paid version is the 1-click packaged build.

Happy to answer anything — especially from agency folks about how you're monitoring client sites today.

## Gallery shots (5)

1. **Dashboard hero** — dark admin dashboard with 6 monitors, green pulsing status dots, uptime % and response times per row.
2. **Public status page** — branded /status page, "All systems operational" banner, three monitor tiles with 90-day green bars.
3. **Monitor detail** — 24h/7d/30d uptime tiles, emerald response-time sparkline, incident log with a resolved incident.
4. **Down alert moment** — status page in partial-outage state (amber banner) side-by-side with the Slack webhook message it fired.
5. **Price math** — simple graphic: "UptimeRobot $96/yr vs Uptime Monitor $39 once — free after month 5."
