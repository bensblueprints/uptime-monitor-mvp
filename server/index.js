import 'dotenv/config';
import { createApp } from './app.js';
import { startScheduler } from './checker.js';

const PORT = parseInt(process.env.PORT || '5301', 10);

if (!process.env.ADMIN_PASSWORD && process.env.AUTH_DISABLED !== 'true') {
  console.warn(
    '[warn] ADMIN_PASSWORD is not set — admin login will be impossible. Set it in .env'
  );
}

const app = createApp();
app.listen(PORT, () => {
  console.log(`Uptime Monitor listening on http://localhost:${PORT}`);
  startScheduler();
});
