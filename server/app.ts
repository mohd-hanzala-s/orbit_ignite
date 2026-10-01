import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import multer from 'multer';
import { loadUser, csrfGuard } from './auth.ts';
import { authRouter } from './routes/auth.ts';
import { catalogRouter } from './routes/catalog.ts';
import { learnRouter, scormStatic } from './routes/learn.ts';
import { meRouter } from './routes/me.ts';
import { adminRouter } from './routes/admin.ts';
import { authoringRouter } from './routes/authoring.ts';
import { filesRouter } from './routes/files.ts';
import { HttpError } from './util.ts';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Content-Security-Policy', "frame-ancestors 'self'");
    next();
  });
  app.use(express.json({ limit: '4mb' }));
  app.use(loadUser);

  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.use('/scorm-content', scormStatic);

  const api = express.Router();
  api.use(csrfGuard);
  api.use('/auth', authRouter);
  api.use('/files', filesRouter);
  api.use('/me', meRouter);
  api.use('/admin', adminRouter);
  api.use('/admin', authoringRouter);
  api.use(catalogRouter);
  api.use(learnRouter);
  api.use((_req, res) => res.status(404).json({ error: 'Not found' }));
  app.use('/api', api);

  const dist = path.resolve(process.cwd(), 'dist');
  if (fs.existsSync(path.join(dist, 'index.html'))) {
    app.use(express.static(dist, { index: false, maxAge: '1h' }));
    app.use((req, res, next) => {
      if (req.method !== 'GET' || req.path.startsWith('/api')) return next();
      res.sendFile(path.join(dist, 'index.html'));
    });
  }

  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message, code: err.code });
    if (err instanceof multer.MulterError) return res.status(err.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'That file is too large.' : err.message });
    if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'Malformed request body' });
    if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'Request is too large' });
    console.error(err);
    res.status(500).json({ error: 'Something went wrong on our side. Please try again.' });
  });
  return app;
}
