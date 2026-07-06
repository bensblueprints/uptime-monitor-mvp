import React, { useEffect, useState } from 'react';
import { Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import { Activity, Globe, LogOut } from 'lucide-react';
import { api } from './api.js';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import MonitorDetail from './pages/MonitorDetail.jsx';
import StatusPage from './pages/StatusPage.jsx';

function AdminShell({ children, onLogout }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <Activity className="h-5 w-5 text-emerald-400" />
            Uptime Monitor
          </Link>
          <nav className="flex items-center gap-4 text-sm text-zinc-400">
            <Link to="/status" className="flex items-center gap-1.5 hover:text-zinc-100 transition-colors">
              <Globe className="h-4 w-4" /> Status page
            </Link>
            <button
              onClick={onLogout}
              className="flex items-center gap-1.5 hover:text-zinc-100 transition-colors"
            >
              <LogOut className="h-4 w-4" /> Logout
            </button>
          </nav>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}

export default function App() {
  const [authed, setAuthed] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const isPublic = location.pathname.startsWith('/status');

  useEffect(() => {
    if (isPublic) return;
    api('/api/me')
      .then((d) => setAuthed(d.authed))
      .catch(() => setAuthed(false));
  }, [isPublic]);

  async function logout() {
    await api('/api/logout', { method: 'POST' }).catch(() => {});
    setAuthed(false);
  }

  if (isPublic) {
    return (
      <Routes>
        <Route path="/status" element={<StatusPage />} />
      </Routes>
    );
  }

  if (authed === null) return <div className="min-h-screen" />;
  if (!authed) return <Login onLogin={() => { setAuthed(true); navigate('/'); }} />;

  return (
    <AdminShell onLogout={logout}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/monitors/:id" element={<MonitorDetail />} />
      </Routes>
    </AdminShell>
  );
}
