import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { api } from '../api.js';
import { StatusDot, Sparkline, UptimeBars, fmtAgo, fmtDuration } from '../components.jsx';

function Tile({ label, value }) {
  return (
    <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl px-5 py-4">
      <div className="text-2xl font-semibold tracking-tight">{value}</div>
      <div className="text-xs text-zinc-500 mt-1">{label}</div>
    </div>
  );
}

export default function MonitorDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);

  async function load() {
    try {
      setData(await api(`/api/monitors/${id}/detail`));
    } catch { /* ignore */ }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [id]);

  if (!data) return <div className="text-zinc-500">Loading…</div>;
  const { monitor, uptime, checks, incidents, bars } = data;
  const fmt = (v) => (v === null ? '—' : `${v}%`);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-200 transition-colors">
        <ArrowLeft className="h-4 w-4" /> All monitors
      </Link>

      <div className="flex items-center gap-3">
        <StatusDot status={monitor.current_status} size="lg" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{monitor.name}</h1>
          <a href={monitor.url} target="_blank" rel="noreferrer" className="text-sm text-zinc-500 hover:text-emerald-400">
            {monitor.url}
          </a>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Tile label="Uptime — 24 hours" value={fmt(uptime['24h'])} />
        <Tile label="Uptime — 7 days" value={fmt(uptime['7d'])} />
        <Tile label="Uptime — 30 days" value={fmt(uptime['30d'])} />
      </div>

      <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5">
        <h2 className="text-sm font-medium text-zinc-400 mb-3">Response time — last {checks.length} checks</h2>
        <Sparkline checks={checks} />
      </div>

      <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5">
        <h2 className="text-sm font-medium text-zinc-400 mb-3">90-day uptime</h2>
        <UptimeBars bars={bars} />
      </div>

      <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5">
        <h2 className="text-sm font-medium text-zinc-400 mb-4">Incidents</h2>
        {incidents.length === 0 && (
          <p className="text-sm text-zinc-600 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" /> No incidents recorded.
          </p>
        )}
        <div className="space-y-3">
          {incidents.map((inc) => (
            <div key={inc.id} className="flex items-start gap-3 text-sm border-b border-zinc-800/60 pb-3 last:border-0 last:pb-0">
              <AlertTriangle className={`h-4 w-4 mt-0.5 ${inc.ended_at ? 'text-zinc-600' : 'text-red-400'}`} />
              <div className="flex-1">
                <div className="text-zinc-200">{inc.cause}</div>
                <div className="text-xs text-zinc-500 mt-0.5">
                  {new Date(inc.started_at).toLocaleString()} ·{' '}
                  {inc.ended_at
                    ? `resolved after ${fmtDuration(inc.ended_at - inc.started_at)}`
                    : 'ongoing'}
                </div>
              </div>
              {!inc.ended_at && (
                <span className="text-[11px] uppercase tracking-wide text-red-400 bg-red-500/10 border border-red-500/30 rounded-full px-2 py-0.5">
                  Active
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-zinc-600">Last checked {fmtAgo(monitor.last_check_at)}</p>
    </motion.div>
  );
}
