// Thin Electron wrapper: boots the same Express server on a free local port
// with data stored in Electron's userData dir, then opens a window pointing
// at it. Auth is disabled (local desktop = already the admin).
import { app, BrowserWindow } from 'electron';
import path from 'node:path';

app.whenReady().then(async () => {
  process.env.DB_PATH = path.join(app.getPath('userData'), 'uptime.db');
  process.env.AUTH_DISABLED = 'true';

  // Import server modules only after env is set (db.js reads DB_PATH at import)
  const { createApp } = await import('../server/app.js');
  const { startScheduler } = await import('../server/checker.js');

  const server = createApp().listen(0, '127.0.0.1', () => {
    const port = server.address().port;
    startScheduler();

    const win = new BrowserWindow({
      width: 1320,
      height: 860,
      backgroundColor: '#09090b',
      autoHideMenuBar: true,
      title: 'Uptime Monitor'
    });
    win.loadURL(`http://127.0.0.1:${port}/`);
  });

  app.on('window-all-closed', () => {
    server.close();
    app.quit();
  });
});
