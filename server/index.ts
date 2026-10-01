import { createApp } from './app.ts';
import { db } from './db.ts';
import { seedIfEmpty, bootstrapEmpty } from './seed.ts';

if (process.env.SEED_DEMO === '0') bootstrapEmpty();
else await seedIfEmpty();
const port = Number(process.env.PORT || 4000);
createApp().listen(port, () => {
  const users = (db.prepare('SELECT COUNT(*) n FROM users').get() as any).n;
  console.log(`\n  🚀 Orbit Ignite is live on http://localhost:${port}  (${users} users)\n`);
});
