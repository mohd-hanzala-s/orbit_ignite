import fs from 'node:fs';
import path from 'node:path';
import { unzipSync } from 'fflate';
import { q, bad } from '../util.ts';
import { SCORM_DIR } from '../db.ts';

const MAX_UNZIPPED = 600 * 1024 * 1024;

const attr = (xml: string, tag: string, name: string): string | undefined => {
  const m = new RegExp(`<${tag}\\b[^>]*?\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i').exec(xml);
  return m ? (m[2] ?? m[3]) : undefined;
};
const decode = (s: string) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");

/** Extracts a SCORM 1.2 / 2004 / xAPI-less web package and records it. Throws a friendly error if invalid. */
export function installScormPackage(zipPath: string, uploadedBy: number, titleOverride?: string) {
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(new Uint8Array(fs.readFileSync(zipPath)));
  } catch {
    throw bad('That file is not a valid ZIP archive.');
  }
  const names = Object.keys(entries).filter((n) => !n.endsWith('/'));
  const manifestName = names.find((n) => n.toLowerCase() === 'imsmanifest.xml') ?? names.find((n) => n.toLowerCase().endsWith('/imsmanifest.xml'));
  if (!manifestName) throw bad('No imsmanifest.xml found. Upload a SCORM package exported as a ZIP (manifest at the root).');
  const root = manifestName.slice(0, manifestName.length - 'imsmanifest.xml'.length);
  const xml = Buffer.from(entries[manifestName]).toString('utf8');

  const schemaVersion = /<schemaversion>([^<]*)</i.exec(xml)?.[1]?.trim() ?? '';
  const version = /2004|CAM 1\.3/i.test(schemaVersion) || /adlcp_v1p3|imsss/i.test(xml) ? '2004' : '1.2';

  // Find default organization → first item with identifierref → resource href
  const defaultOrg = attr(xml, 'organizations', 'default');
  const orgBlocks = [...xml.matchAll(/<organization\b[\s\S]*?<\/organization>/gi)].map((m) => m[0]);
  const org = orgBlocks.find((b) => attr(b, 'organization', 'identifier') === defaultOrg) ?? orgBlocks[0];
  let title = titleOverride || (org && decode(/<title>([\s\S]*?)<\/title>/i.exec(org)?.[1]?.trim() ?? '')) || 'SCORM package';
  let ref: string | undefined;
  if (org) {
    for (const m of org.matchAll(/<item\b[^>]*>/gi)) {
      const r = attr(m[0], 'item', 'identifierref');
      if (r) {
        ref = r;
        break;
      }
    }
  }
  const resources = [...xml.matchAll(/<resource\b[^>]*>/gi)].map((m) => m[0]);
  const resTag = (ref && resources.find((r) => attr(r, 'resource', 'identifier') === ref)) || resources.find((r) => /scormtype\s*=\s*["']sco["']/i.test(r)) || resources[0];
  const baseAttr = resTag ? attr(xml.slice(Math.max(0, xml.indexOf(resTag) - 400), xml.indexOf(resTag) + 10), 'resources', 'xml:base') : undefined;
  const href = resTag ? attr(resTag, 'resource', 'href') : undefined;
  if (!href) throw bad('The manifest does not declare a launchable resource.');
  const launch = decode(((attr(resTag!, 'resource', 'xml:base') ?? baseAttr ?? '') + href).replace(/^\.\//, ''));

  const insert = q.run('INSERT INTO scorm_packages(title, version, launch_path, dir, uploaded_by) VALUES (?,?,?,?,?)', title, version, launch, '', uploadedBy);
  const dir = String(insert.id);
  const dest = path.join(SCORM_DIR, dir);
  let size = 0;
  let files = 0;
  try {
    for (const name of names) {
      if (!name.startsWith(root)) continue;
      const rel = name.slice(root.length);
      const target = path.resolve(dest, rel);
      if (!target.startsWith(dest + path.sep)) continue; // zip-slip guard
      const data = entries[name];
      size += data.length;
      if (size > MAX_UNZIPPED) throw bad('Package is too large when extracted.');
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, data);
      files++;
    }
    if (!fs.existsSync(path.join(dest, launch.split('?')[0]))) throw bad(`Launch file “${launch}” is missing from the package.`);
  } catch (e) {
    fs.rmSync(dest, { recursive: true, force: true });
    q.run('DELETE FROM scorm_packages WHERE id=?', insert.id);
    throw e;
  }
  q.run('UPDATE scorm_packages SET dir=?, file_count=?, size=? WHERE id=?', dir, files, size, insert.id);
  return q.get('SELECT * FROM scorm_packages WHERE id=?', insert.id)!;
}

/** Normalise SCORM 1.2 and 2004 CMI payloads to a single completion/score summary. */
export function summariseCmi(cmi: Record<string, string>) {
  const get = (k: string) => cmi[k];
  const lessonStatus = get('cmi.core.lesson_status'); // 1.2
  const completion = get('cmi.completion_status'); // 2004
  const success = get('cmi.success_status');
  const rawScore = get('cmi.core.score.raw') ?? get('cmi.score.raw');
  const scaled = get('cmi.score.scaled');
  const completed = ['completed', 'passed'].includes(lessonStatus ?? '') || completion === 'completed' || success === 'passed';
  const failed = lessonStatus === 'failed' || success === 'failed';
  let score: number | null = null;
  if (rawScore != null && rawScore !== '' && !Number.isNaN(Number(rawScore))) score = Number(rawScore);
  else if (scaled != null && scaled !== '' && !Number.isNaN(Number(scaled))) score = Number(scaled) * 100;
  const status = completed ? 'completed' : failed ? 'failed' : lessonStatus === 'incomplete' || completion === 'incomplete' ? 'incomplete' : 'not attempted';
  return { completed, failed, score, status };
}
