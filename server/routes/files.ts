import { Router } from 'express';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import mammoth from 'mammoth';
import { requireAuth, requireRole } from '../auth.ts';
import { q, bad, notFound, intParam, wrap, log } from '../util.ts';
import { UPLOAD_DIR } from '../db.ts';
import { installScormPackage } from '../services/scorm.ts';

export const filesRouter = Router();

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req, file, cb) => cb(null, crypto.randomBytes(12).toString('hex') + path.extname(file.originalname).toLowerCase().slice(0, 12)),
  }),
  limits: { fileSize: Number(process.env.MAX_UPLOAD_MB || 1024) * 1024 * 1024 },
});

const KIND_BY_EXT: Record<string, string> = {
  mp4: 'video', webm: 'video', mov: 'video', m4v: 'video', ogv: 'video', mkv: 'video',
  mp3: 'audio', wav: 'audio', ogg: 'audio', m4a: 'audio', aac: 'audio', flac: 'audio',
  pdf: 'pdf',
  png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', webp: 'image', svg: 'image', avif: 'image',
  doc: 'office', docx: 'office', ppt: 'office', pptx: 'office', xls: 'office', xlsx: 'office', odt: 'office', odp: 'office', ods: 'office',
  txt: 'text', md: 'text', csv: 'text', json: 'text', xml: 'text', html: 'text', log: 'text',
  zip: 'archive', vtt: 'text', srt: 'text',
};
const MIME: Record<string, string> = {
  mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', m4v: 'video/mp4', ogv: 'video/ogg', mkv: 'video/x-matroska',
  mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', m4a: 'audio/mp4', aac: 'audio/aac', flac: 'audio/flac',
  pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif',
  vtt: 'text/vtt', srt: 'text/plain', txt: 'text/plain', md: 'text/plain', csv: 'text/csv', json: 'application/json', xml: 'text/plain', log: 'text/plain',
};
const ext = (n: string) => path.extname(n).slice(1).toLowerCase();
const kindOf = (name: string) => KIND_BY_EXT[ext(name)] ?? 'other';
const safeMime = (name: string, fallback: string) => MIME[ext(name)] ?? (kindOf(name) === 'other' || kindOf(name) === 'office' ? 'application/octet-stream' : fallback);

export const fileDto = (f: any) => ({
  id: f.id,
  name: f.original_name,
  mime: f.mime,
  size: f.size,
  kind: f.kind,
  createdAt: f.created_at,
  uploadedBy: f.uploaded_by,
  url: `/api/files/${f.id}`,
});

filesRouter.post(
  '/',
  requireAuth,
  upload.single('file'),
  wrap((req, res) => {
    const f = req.file;
    if (!f) throw bad('No file received');
    const isStaff = req.user!.role !== 'learner';
    const original = Buffer.from(f.originalname, 'latin1').toString('utf8');
    const kind = kindOf(original);
    // Learners may only upload assignment material (docs/images/archives), never scripts/html.
    if (!isStaff && ['video', 'audio'].includes(kind) === false && ext(original) === 'html') {
      fs.rmSync(f.path, { force: true });
      throw bad('This file type is not allowed.');
    }
    const r = q.run('INSERT INTO files(original_name, mime, size, stored_name, kind, uploaded_by) VALUES (?,?,?,?,?,?)', original, safeMime(original, f.mimetype), f.size, f.filename, kind, req.user!.id);
    log(req.user!.id, 'file.uploaded', 'file', r.id, { name: original });
    res.status(201).json(fileDto(q.get('SELECT * FROM files WHERE id=?', r.id)));
  }),
);

filesRouter.post(
  '/scorm',
  requireRole('admin', 'instructor'),
  upload.single('file'),
  wrap((req, res) => {
    if (!req.file) throw bad('No file received');
    try {
      const pkg = installScormPackage(req.file.path, req.user!.id, typeof req.body.title === 'string' && req.body.title.trim() ? req.body.title.trim() : undefined);
      log(req.user!.id, 'scorm.uploaded', 'scorm', Number(pkg.id), { title: pkg.title });
      res.status(201).json({ id: pkg.id, title: pkg.title, version: pkg.version, launchPath: pkg.launch_path, fileCount: pkg.file_count, size: pkg.size });
    } finally {
      fs.rmSync(req.file.path, { force: true });
    }
  }),
);

filesRouter.get(
  '/',
  requireRole('admin', 'instructor'),
  wrap((req, res) => {
    const kind = typeof req.query.kind === 'string' ? req.query.kind : '';
    const search = typeof req.query.q === 'string' ? `%${req.query.q}%` : '%';
    const rows = q.all(
      `SELECT f.*, u.name uploader FROM files f LEFT JOIN users u ON u.id=f.uploaded_by
       WHERE (?='' OR f.kind=?) AND f.original_name LIKE ? ORDER BY f.id DESC LIMIT 500`,
      kind, kind, search,
    );
    const scorm = q.all('SELECT p.*, u.name uploader FROM scorm_packages p LEFT JOIN users u ON u.id=p.uploaded_by ORDER BY p.id DESC');
    res.json({
      files: rows.map((f) => ({ ...fileDto(f), uploader: f.uploader })),
      scorm: scorm.map((p) => ({ id: p.id, title: p.title, version: p.version, size: p.size, fileCount: p.file_count, createdAt: p.created_at, uploader: p.uploader })),
    });
  }),
);

function sendStored(req: any, res: any, inline: boolean) {
  const id = intParam(req, 'id');
  const f = q.get('SELECT * FROM files WHERE id=?', id);
  if (!f) throw notFound('File not found');
  const full = path.join(UPLOAD_DIR, f.stored_name);
  if (!fs.existsSync(full)) throw notFound('File data is missing');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Type', f.mime);
  res.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(f.original_name)}`);
  // never let uploaded documents execute scripts in our origin
  if (f.kind !== 'video' && f.kind !== 'audio' && f.kind !== 'image') res.setHeader('Content-Security-Policy', "sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data:");
  res.sendFile(full, { dotfiles: 'allow', acceptRanges: true, headers: { 'Content-Type': f.mime } });
}

filesRouter.get('/:id/download', requireAuth, wrap((req, res) => sendStored(req, res, false)));
filesRouter.get('/:id', requireAuth, wrap((req, res) => sendStored(req, res, true)));

/** HTML preview for .docx (via mammoth) and plain text types. */
filesRouter.get(
  '/:id/preview',
  requireAuth,
  wrap(async (req, res) => {
    const id = intParam(req, 'id');
    const f = q.get('SELECT * FROM files WHERE id=?', id);
    if (!f) throw notFound('File not found');
    const full = path.join(UPLOAD_DIR, f.stored_name);
    if (!fs.existsSync(full)) throw notFound('File data is missing');
    const e = ext(f.original_name);
    if (e === 'docx') {
      const out = await mammoth.convertToHtml({ path: full });
      return res.json({ type: 'html', html: out.value });
    }
    if (f.kind === 'text') {
      const buf = fs.readFileSync(full).subarray(0, 400_000);
      return res.json({ type: e === 'md' ? 'markdown' : 'text', text: buf.toString('utf8'), ext: e });
    }
    res.json({ type: 'none' });
  }),
);

filesRouter.delete(
  '/:id',
  requireRole('admin', 'instructor'),
  wrap((req, res) => {
    const id = intParam(req, 'id');
    const f = q.get('SELECT * FROM files WHERE id=?', id);
    if (!f) throw notFound();
    if (req.user!.role !== 'admin' && f.uploaded_by !== req.user!.id) throw bad('Only the uploader or an admin can delete this file');
    const used = q.get(`SELECT COUNT(*) n FROM lessons WHERE content LIKE ?`, `%"fileId":${id}%`);
    if (Number(used?.n) > 0) throw bad(`This file is used by ${used!.n} lesson(s). Remove it from those lessons first.`);
    fs.rmSync(path.join(UPLOAD_DIR, f.stored_name), { force: true });
    q.run('DELETE FROM files WHERE id=?', id);
    res.json({ ok: true });
  }),
);
