import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, AlertTriangle, XCircle, Activity } from 'lucide-react';
import { UptimeBars } from '../components.jsx';

const BANNERS = {
  operational: {
    icon: CheckCircle2,
    text: 'All systems operational',
    cls: 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
  },
  partial_outage: {
    icon: AlertTriangle,
    text: 'Partial outage',
    cls: 'bg-amber-500/10 border-amber-500/40 text-amber-300'
  },
  major_outage: {
    icon: XCircle,
    text: 'Major outage',
    cls: 'bg-red-500/10 border-red-500/40 text-red-300'
  }
};

export default function StatusPage() {
  const [data, setData] = useState(null);

  async function load() {
    try {
      const res = await fetch('/api/public/status');
      setData(await res.json());
    } catch { /* retry on next tick */ }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);

  if (!data) return <div className="min-h-screen" />;
  const banner = BANNERS[data.overall] || BANNERS.operational;
  const Icon = banner.icon;

  return (
    <div className="min-h-screen">
      <div className="max-w-3xl mx-auto px-6 py-14">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-2 text-zinc-400 mb-8">
            <Activity className="h-5 w-5 text-emerald-400" />
            <span className="font-semibold text-zinc-100 tracking-tight">{data.name}</span>
          </div>

          <div className={`border rounded-2xl px-6 py-5 flex items-center gap-3 text-lg font-medium ${banner.cls}`}>
            <Icon className="h-6 w-6" />
            {banner.text}
          </div>

          <div className="mt-8 space-y-3">
            {data.monitors.length === 0 && (
              <p className="text-zinc-500 text-sm">No services are being monitored yet.</p>
            )}
            {data.monitors.map((m) => (
              <div key={m.id} className="bg-zinc-900/60 border border-zinc-800 rounded-xl px-5 py-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="font-medium">{m.name}</div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-zinc-500">
                      {m.uptime_90d === null ? '' : `${m.uptime_90d}% · 90 days`}
                    </span>
                    {m.status === 'up' && (
                      <span className="text-xs font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-full px-2.5 py-0.5">
                        Operational
                      </span>
                    )}
                    {m.status === 'down' && (
                      <span className="text-xs font-medium text-red-400 bg-red-500/10 border border-red-500/30 rounded-full px-2.5 py-0.5">
                        Down
                      </span>
                    )}
                    {m.status === 'pending' && (
                      <span className="text-xs font-medium text-zinc-400 bg-zinc-500/10 border border-zinc-500/30 rounded-full px-2.5 py-0.5">
                        Pending
                      </span>
                    )}
                  </div>
                </div>
                <UptimeBars bars={m.bars} height="h-7" />
                <div className="flex justify-between text-[11px] text-zinc-600 mt-1.5">
                  <span>90 days ago</span>
                  <span>Today</span>
                </div>
              </div>
            ))}
          </div>

          <p className="text-xs text-zinc-600 mt-10 text-center">
            Updated {new Date(data.updated_at).toLocaleTimeString()} · Powered by Uptime Monitor
          </p>
        </motion.div>
      </div>
    </div>
  );
}
