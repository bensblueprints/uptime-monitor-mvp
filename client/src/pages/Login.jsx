import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Activity, Lock } from 'lucide-react';
import { api } from '../api.js';

export default function Login({ onLogin }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/api/login', { method: 'POST', body: { password } });
      onLogin();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <motion.form
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        onSubmit={submit}
        className="w-full max-w-sm bg-zinc-900/60 border border-zinc-800 rounded-2xl p-8 space-y-5"
      >
        <div className="flex flex-col items-center gap-2 pb-2">
          <Activity className="h-8 w-8 text-emerald-400" />
          <h1 className="text-xl font-semibold tracking-tight">Uptime Monitor</h1>
          <p className="text-sm text-zinc-500">Admin access</p>
        </div>
        <div className="relative">
          <Lock className="h-4 w-4 absolute left-3 top-3 text-zinc-500" />
          <input
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Admin password"
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500/60"
          />
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          disabled={busy}
          className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-zinc-950 font-medium rounded-lg py-2.5 text-sm transition-colors"
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </motion.form>
    </div>
  );
}
