import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Pause, Play, Trash2, RefreshCw, Timer, X } from 'lucide-react';
import { api } from '../api.js';
import { StatusDot, fmtAgo } from '../components.jsx';

const INTERVALS = [
  [30, '30 seconds'],
  [60, '1 minute'],
  [120, '2 minutes'],
  [300, '5 minutes'],
  [600, '10 minutes'],
  [900, '15 minutes']
];

function AddMonitorModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    name: '',
    url: 'https://',
    interval_seconds: 60,
    expected_status: '',
    keyword: '',
    webhook_url: ''
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/api/monitors', {
        method: 'POST',
        body: {
          ...form,
          expected_status: form.expected_status ? parseInt(form.expected_status, 10) : 0,
          interval_seconds: parseInt(form.interval_seconds, 10)
        }
      });
      onCreated();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const input =
    'w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500/60';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center px-6"
      onClick={onClose}
    >
      <motion.form
        initial={{ scale: 0.95, y: 10 }}
        animate={{ scale: 1, y: 0 }}
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Add monitor</h2>
          <button type="button" onClick={onClose} className="text-zinc-500 hover:text-zinc-200">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 md:col-span-1">
            <label className="text-xs text-zinc-500 block mb-1">Name</label>
            <input required className={input} value={form.name} onChange={set('name')} placeholder="Client site" />
          </div>
          <div className="col-span-2 md:col-span-1">
            <label className="text-xs text-zinc-500 block mb-1">Check interval</label>
            <select className={input} value={form.interval_seconds} onChange={set('interval_seconds')}>
              {INTERVALS.map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <div className="col-span-2">
            <label className="text-xs text-zinc-500 block mb-1">URL</label>
            <input required className={input} value={form.url} onChange={set('url')} placeholder="https://example.com" />
          </div>
          <div>
            <label className="text-xs text-zinc-500 block mb-1">Expected status (blank = any 2xx/3xx)</label>
            <input className={input} value={form.expected_status} onChange={set('expected_status')} placeholder="200" />
          </div>
          <div>
            <label className="text-xs text-zinc-500 block mb-1">Keyword match (optional)</label>
            <input className={input} value={form.keyword} onChange={set('keyword')} placeholder="Welcome" />
          </div>
          <div className="col-span-2">
            <label className="text-xs text-zinc-500 block mb-1">Alert webhook URL (optional)</label>
            <input className={input} value={form.webhook_url} onChange={set('webhook_url')} placeholder="https://hooks.slack.com/…" />
          </div>
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          disabled={busy}
          className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-zinc-950 font-medium rounded-lg py-2.5 text-sm transition-colors"
        >
          {busy ? 'Creating…' : 'Create monitor'}
        </button>
      </motion.form>
    </motion.div>
  );
}

export default function Dashboard() {
  const [monitors, setMonitors] = useState(null);
  const [showAdd, setShowAdd] = useState(false);

  async function load() {
    try {
      setMonitors(await api('/api/monitors'));
    } catch { /* session may have expired; App handles auth */ }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, []);

  async function togglePause(m) {
    await api(`/api/monitors/${m.id}`, { method: 'PATCH', body: { paused: !m.paused } });
    load();
  }

  async function remove(m) {
    if (!confirm(`Delete monitor "${m.name}"? All history will be lost.`)) return;
    await api(`/api/monitors/${m.id}`, { method: 'DELETE' });
    load();
  }

  async function checkNow(m) {
    await api(`/api/monitors/${m.id}/check`, { method: 'POST' });
    load();
  }

  if (monitors === null) return <div className="text-zinc-500">Loading…</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Monitors</h1>
          <p className="text-sm text-zinc-500 mt-1">
            {monitors.filter((m) => m.current_status === 'up').length}/{monitors.length} up
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-medium rounded-lg px-4 py-2 text-sm transition-colors"
        >
          <Plus className="h-4 w-4" /> Add monitor
        </button>
      </div>

      {monitors.length === 0 && (
        <div className="border border-dashed border-zinc-800 rounded-2xl py-16 text-center text-zinc-500">
          No monitors yet. Add your first site to start tracking uptime.
        </div>
      )}

      <div className="space-y-2">
        <AnimatePresence>
          {monitors.map((m) => (
            <motion.div
              key={m.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={`bg-zinc-900/60 border border-zinc-800 rounded-xl px-5 py-4 flex items-center gap-4 ${m.paused ? 'opacity-50' : ''}`}
            >
              <StatusDot status={m.paused ? 'pending' : m.current_status} />
              <Link to={`/monitors/${m.id}`} className="flex-1 min-w-0 group">
                <div className="font-medium group-hover:text-emerald-400 transition-colors truncate">
                  {m.name}
                </div>
                <div className="text-xs text-zinc-500 truncate">{m.url}</div>
              </Link>
              <div className="hidden md:flex items-center gap-6 text-sm text-zinc-400">
                <div className="text-right">
                  <div className="text-zinc-200">{m.uptime_24h === null ? '—' : `${m.uptime_24h}%`}</div>
                  <div className="text-[11px] text-zinc-600">24h uptime</div>
                </div>
                <div className="text-right">
                  <div className="text-zinc-200">{m.last_response_ms === null ? '—' : `${m.last_response_ms}ms`}</div>
                  <div className="text-[11px] text-zinc-600">response</div>
                </div>
                <div className="text-right w-20">
                  <div className="flex items-center justify-end gap-1 text-zinc-200">
                    <Timer className="h-3.5 w-3.5 text-zinc-600" />
                    {m.interval_seconds >= 60 ? `${m.interval_seconds / 60}m` : `${m.interval_seconds}s`}
                  </div>
                  <div className="text-[11px] text-zinc-600">{fmtAgo(m.last_check_at)}</div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button title="Check now" onClick={() => checkNow(m)} className="p-2 text-zinc-500 hover:text-emerald-400 transition-colors">
                  <RefreshCw className="h-4 w-4" />
                </button>
                <button title={m.paused ? 'Resume' : 'Pause'} onClick={() => togglePause(m)} className="p-2 text-zinc-500 hover:text-amber-400 transition-colors">
                  {m.paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                </button>
                <button title="Delete" onClick={() => remove(m)} className="p-2 text-zinc-500 hover:text-red-400 transition-colors">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {showAdd && <AddMonitorModal onClose={() => setShowAdd(false)} onCreated={load} />}
      </AnimatePresence>
    </div>
  );
}
