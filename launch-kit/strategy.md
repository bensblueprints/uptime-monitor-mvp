# Launch Strategy — Uptime Monitor

## Target communities

| Community | Angle (rules-aware) |
|---|---|
| r/selfhosted | Genuine "I built a self-hosted UptimeRobot alternative, MIT source" post. This sub loves owning data; lead with the GitHub repo, not the paid installer. Mention Docker one-liner. |
| r/webdev | "Show-off Saturday" thread: dashboard + status page screenshots, the story of replacing a subscription with one Node process. No direct selling outside showcase threads. |
| r/msp & r/agency | Pain-point framing: "how do you monitor 40 client sites without per-monitor pricing?" Discuss workflow first, tool second — both subs remove drive-by promo. |
| r/sysadmin | Only in weekly promo/tool threads. Emphasize SQLite simplicity vs standing up Zabbix/Nagios for basic HTTP checks. |
| r/SideProject / r/indiehackers | Full story post: build, pricing choice ($39 one-time vs SaaS), revenue transparency welcome here. |
| Indie Hackers forum | "Why I priced my uptime monitor at $39 one-time" — pricing-strategy posts perform well and market the product implicitly. |

## Hacker News — Show HN draft

**Title:** Show HN: Self-hosted uptime monitor and status page in one Node process

**Body:**
I manage sites for clients and got tired of the monthly line item for uptime monitoring, so I built the ownable version.

It's deliberately boring tech: Express + better-sqlite3 + an in-process checker loop (no Redis, no cron, no workers). Monitors are HTTP(S) with 30s–15m intervals, optional expected-status and keyword assertions. State transitions open/close incident rows and fire webhook + SMTP alerts. There's a public /status page with the classic 90-day uptime bars, and 90-day retention pruning keeps the SQLite file small. It also runs as a desktop app via a thin Electron wrapper around the same server.

Source is MIT. I sell a packaged installer for people who don't want to touch a terminal, which is the business model experiment: one-time $39 instead of a subscription.

Known limits: HTTP checks only (no ICMP/TCP yet), single admin user, one region (your VPS). Curious how HN feels about one-time pricing for infra tools — and what check types you'd want next.

## SEO keywords (10)

1. self-hosted uptime monitor
2. uptimerobot alternative self-hosted
3. pingdom alternative open source
4. free uptime monitoring self hosted
5. status page self hosted
6. website down alert tool
7. uptime monitor docker
8. one-time purchase uptime monitoring
9. agency website monitoring tool
10. open source status page with uptime bars

## AppSumo / PitchGround pitch

Uptime Monitor is a self-hosted replacement for UptimeRobot and Pingdom that your buyers install once and own forever — a perfect LTD because there's literally no recurring infrastructure cost to the vendor. Agencies and freelancers monitor unlimited client sites from one $5 VPS: 30-second HTTP checks with keyword matching, instant Slack/webhook and email alerts on downtime and recovery, per-site incident history, and a branded public status page with the 90-day uptime bars clients already trust. MIT-licensed source doubles as proof of quality; the paid tier is the packaged 1-click installer plus updates. Monitoring SaaS costs $96–$120+ per year — a one-time deal here is the easiest ROI math your audience will see all month.

## Pricing

**Suggested: $39 one-time** (launch price $29).

Math vs competitors:
- UptimeRobot Solo: $8/mo → **pays for itself in 4.9 months**
- Pingdom Synthetic starter: ~$10/mo → **pays for itself in under 4 months**
- 3-year cost: UptimeRobot $288, Pingdom $360+, Uptime Monitor **$39**

Anchor line for all copy: "Your uptime monitor should not cost more per year than the VPS it watches."
