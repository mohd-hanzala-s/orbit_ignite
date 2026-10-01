import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { db, tx, DATA_DIR, UPLOAD_DIR } from './db.ts';
import { q, setSetting } from './util.ts';
import { hashPassword } from './auth.ts';
import { ensureEnrollment, markLessonComplete } from './services/learning.ts';
import { installScormPackage } from './services/scorm.ts';
import { buildDemoScorm } from './seed-scorm.ts';

export const DEMO_PASSWORD = 'Orbit123!';
const ASSETS = path.resolve(import.meta.dirname, 'seed-assets');

// deterministic PRNG so demo data is stable
let seedN = 20260101;
const rnd = () => ((seedN = (seedN * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
const dayAgo = (d: number, hour = 9) => new Date(Date.now() - d * 864e5 + hour * 36e5 - 12 * 36e5).toISOString().replace('T', ' ').slice(0, 19);

function storeAsset(name: string, mime: string, kind: string, uploader: number) {
  const src = path.join(ASSETS, name);
  const stored = crypto.randomBytes(12).toString('hex') + path.extname(name);
  fs.copyFileSync(src, path.join(UPLOAD_DIR, stored));
  return q.run('INSERT INTO files(original_name, mime, size, stored_name, kind, uploaded_by) VALUES (?,?,?,?,?,?)', name, mime, fs.statSync(src).size, stored, kind, uploader).id;
}

const o = (...texts: string[]) => texts.map((text, i) => ({ id: `o${i + 1}`, text }));

export async function seedIfEmpty(force = false) {
  const existing = Number(q.get('SELECT COUNT(*) n FROM users')!.n);
  if (existing > 0 && !force) return;
  if (force) {
    db.exec('PRAGMA foreign_keys=OFF');
    for (const t of ['users','sessions','categories','files','courses','sections','scorm_packages','lessons','enrollments','lesson_progress','quiz_attempts','submissions','scorm_tracking','notes','bookmarks','discussions','reviews','groups','group_members','group_courses','paths','path_courses','path_enrollments','user_badges','xp_events','certificates','notifications','announcements','activity','settings'])
      db.exec(`DELETE FROM ${t}`);
    db.exec('PRAGMA foreign_keys=ON');
  }
  console.log('🌱 Seeding demo universe…');
  const pw = hashPassword(DEMO_PASSWORD);

  tx(() => {
    setSetting('platform', {});
    /* ── people ── */
    const mkUser = (email: string, name: string, role: string, title: string, dept: string, color: string, joined: number) =>
      q.run('INSERT INTO users(email, name, password_hash, role, title, department, avatar_color, created_at, last_login_at) VALUES (?,?,?,?,?,?,?,?,?)', email, name, pw, role, title, dept, color, dayAgo(joined), dayAgo(Math.floor(rnd() * 3))).id;
    const admin = mkUser('admin@orbit.space', 'Maya Okafor', 'admin', 'Head of Learning', 'Mission Control', 'violet', 80);
    const nova = mkUser('nova@orbit.space', 'Dr. Nova Reyes', 'instructor', 'Astrophysicist & Lead Instructor', 'Science', 'pink', 75);
    const kai = mkUser('kai@orbit.space', 'Kai Lindqvist', 'instructor', 'Flight Safety Engineer', 'Engineering', 'cyan', 70);
    const demo = mkUser('astro@orbit.space', 'Alex Rivera', 'learner', 'Junior Mission Analyst', 'Operations', 'amber', 20);
    const learnerNames: [string, string, string][] = [
      ['Priya Nair', 'Engineering', 'emerald'], ['Jonas Weber', 'Operations', 'blue'], ['Sofia Marino', 'Design', 'pink'], ['Liam O’Connor', 'Science', 'orange'],
      ['Aiko Tanaka', 'Engineering', 'violet'], ['Mateo Silva', 'Operations', 'cyan'], ['Zara Ahmed', 'Science', 'amber'], ['Noah Fischer', 'Design', 'emerald'],
      ['Chloe Dubois', 'Operations', 'pink'], ['Omar Haddad', 'Engineering', 'blue'], ['Isla Campbell', 'Science', 'violet'], ['Ethan Park', 'Operations', 'orange'],
    ];
    const learners = [demo, ...learnerNames.map(([n, d, c], i) => mkUser(`${n.split(' ')[0].toLowerCase().replace(/[^a-z]/g, '')}@orbit.space`, n, 'learner', 'Mission Specialist', d, c, 60 - i * 4))];

    /* ── taxonomy ── */
    const cats: Record<string, number> = {};
    for (const [name, slug, color] of [['Space Science', 'space-science', 'violet'], ['Engineering', 'engineering', 'cyan'], ['Leadership', 'leadership', 'amber'], ['Data & AI', 'data-ai', 'pink'], ['Safety & Compliance', 'safety', 'emerald'], ['Design', 'design', 'orange']])
      cats[name] = q.run('INSERT INTO categories(name, slug, color) VALUES (?,?,?)', name, slug, color).id;

    /* ── files ── */
    const vid = storeAsset('orbit-intro.mp4', 'video/mp4', 'video', admin);
    const aud = storeAsset('ambient-briefing.mp3', 'audio/mpeg', 'audio', admin);
    const pdf = storeAsset('mission-handbook.pdf', 'application/pdf', 'pdf', admin);
    const zipTmp = path.join(DATA_DIR, 'demo-scorm.zip');
    fs.writeFileSync(zipTmp, buildDemoScorm());
    const scorm = installScormPackage(zipTmp, kai, 'Pre-flight Safety Checklist');
    fs.rmSync(zipTmp, { force: true });

    /* ── course factory ── */
    const course = (c: { title: string; subtitle: string; description: string; cat: string; level: string; theme: string; instructor: number; status?: string; featured?: boolean; sequential?: boolean; tags: string[]; objectives: string[]; days: number }) => {
      const id = q.run(
        `INSERT INTO courses(title, subtitle, description, category_id, level, status, theme, instructor_id, tags, objectives, featured, sequential, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        c.title, c.subtitle, c.description, cats[c.cat], c.level, c.status ?? 'published', c.theme, c.instructor, JSON.stringify(c.tags), JSON.stringify(c.objectives), c.featured ? 1 : 0, c.sequential ? 1 : 0, dayAgo(c.days), dayAgo(Math.max(1, c.days - 5)),
      ).id;
      return id;
    };
    let pos = 0;
    const section = (cid: number, title: string) => q.run('INSERT INTO sections(course_id, title, position) VALUES (?,?,?)', cid, title, pos++).id;
    const lesson = (cid: number, sid: number, type: string, title: string, minutes: number, content: object, extra: { preview?: boolean; required?: boolean; summary?: string } = {}) =>
      q.run('INSERT INTO lessons(course_id, section_id, title, type, position, duration_minutes, required, preview, summary, content) VALUES (?,?,?,?,?,?,?,?,?,?)', cid, sid, title, type, pos++, minutes, extra.required === false ? 0 : 1, extra.preview ? 1 : 0, extra.summary ?? '', JSON.stringify(content)).id;

    /* ═══════ Course 1: Foundations of Space Exploration ═══════ */
    const c1 = course({
      title: 'Foundations of Space Exploration', subtitle: 'From the first rockets to the Artemis era — the science, the missions and the people.',
      description: 'A guided tour of how humanity left the planet. You will learn the physics that keeps satellites in orbit, how missions are planned, and what it takes to put people on the Moon and beyond.\n\nThis course blends short video lessons, an interactive reading, quizzes, and a capstone assignment. No prior knowledge required — just curiosity.',
      cat: 'Space Science', level: 'Beginner', theme: 'nebula', instructor: nova, featured: true, tags: ['astronomy', 'orbital mechanics', 'missions'],
      objectives: ['Explain how orbits work using gravity and velocity', 'Describe the phases of a space mission', 'Compare launch vehicles and propulsion types', 'Plan a simple mission profile'], days: 60,
    });
    pos = 0;
    let s = section(c1, 'Launchpad');
    const l1a = lesson(c1, s, 'video', 'Welcome to the mission', 2, { source: 'upload', fileId: vid, transcript: 'Welcome aboard! In this short intro we zoom into the Mandelbrot set — a reminder that complexity hides inside simple rules, just like orbital mechanics.' }, { preview: true, summary: 'A quick orientation to the course and how learning works here.' });
    const l1b = lesson(c1, s, 'page', 'How this course works', 4, { markdown: `# Welcome, astronaut 🚀\n\nThis course is organised as a **mission**. Each module is a *phase* and each lesson is a *checkpoint*.\n\n## What you'll do\n\n1. Watch short videos and read concise briefings\n2. Test yourself in quizzes — you can retry as often as you like\n3. Complete a capstone **mission plan** assignment\n\n## Earning XP\n\n| Action | XP |\n| --- | --- |\n| Complete a lesson | 10 |\n| Pass a quiz | 25 |\n| Finish the course | 100 |\n\n> **Pro tip:** use the *Notes* tab in the player to capture ideas. They're private to you and saved per lesson.\n\n### Keyboard shortcuts\n\n- \`J\` / \`K\` — previous / next lesson\n- \`C\` — mark the lesson complete\n- \`⌘K\` — search everything\n` }, { preview: true });
    lesson(c1, s, 'audio', 'Audio briefing: the history of spaceflight', 6, { fileId: aud, transcript: 'An ambient audio briefing. In your own courses you can attach narration, podcasts and interviews as MP3, WAV, M4A or OGG.' });
    lesson(c1, s, 'document', 'Mission Handbook (PDF)', 8, { fileId: pdf, allowDownload: true }, { summary: 'Your field guide to the learning loop, XP and levels.' });
    s = section(c1, 'Orbital mechanics');
    lesson(c1, s, 'video', 'Timelapse of the future', 12, { source: 'youtube', url: 'https://www.youtube.com/watch?v=uD4izuDMUQA' }, { summary: 'A cosmic perspective on scale and time.' });
    lesson(c1, s, 'page', 'Why things stay in orbit', 7, { markdown: `# Falling… and missing\n\nAn orbit is just a fall that never lands. A satellite moves sideways so fast that as it falls toward Earth, the surface curves away beneath it.\n\n## The key numbers\n\n- **Low Earth Orbit (LEO):** ~7.8 km/s at 400 km altitude — one lap every ~92 minutes\n- **Geostationary orbit:** ~3.07 km/s at 35,786 km — one lap per day, so it hovers over a point\n- **Escape velocity:** ~11.2 km/s from the surface\n\n## Kepler's three laws\n\n1. Orbits are ellipses with the central body at one focus\n2. A line from the body to the satellite sweeps equal areas in equal times\n3. The square of the period scales with the cube of the semi-major axis\n\n\`\`\`python\nimport math\nG, M = 6.674e-11, 5.972e24\ndef period(r_m):\n    return 2 * math.pi * math.sqrt(r_m**3 / (G * M))\nprint(period(6_771_000) / 60)  # ≈ 92.4 minutes\n\`\`\`\n` });
    lesson(c1, s, 'quiz', 'Orbital mechanics check-in', 6, {
      passScore: 70, maxAttempts: 0, showAnswers: true,
      questions: [
        { id: 'q1', type: 'single', prompt: 'What keeps a satellite in orbit?', options: o('Rocket engines firing continuously', 'Sideways velocity balancing gravity’s pull', 'Earth’s magnetic field', 'Air resistance'), correct: ['o2'], points: 1, explanation: 'An orbit is a continuous fall around the planet — velocity and gravity are in balance.' },
        { id: 'q2', type: 'truefalse', prompt: 'A geostationary satellite orbits at a lower altitude than the ISS.', correct: ['false'], points: 1, explanation: 'Geostationary orbit is ~35,786 km up; the ISS is at ~400 km.' },
        { id: 'q3', type: 'multiple', prompt: 'Select all of Kepler’s laws.', options: o('Orbits are ellipses', 'Equal areas in equal times', 'Heavier objects fall faster', 'Period² ∝ distance³'), correct: ['o1', 'o2', 'o4'], points: 2 },
        { id: 'q4', type: 'short', prompt: 'What is the name for an orbit about 400 km above Earth, where the ISS lives? (acronym)', correct: ['LEO', 'low earth orbit'], points: 1 },
        { id: 'q5', type: 'ordering', prompt: 'Order these orbits from lowest to highest altitude.', options: o('Low Earth Orbit', 'Medium Earth Orbit', 'Geostationary orbit', 'Lunar orbit'), points: 2, explanation: 'LEO < MEO < GEO < Lunar distance.' },
      ],
    });
    s = section(c1, 'Mission wrap-up');
    lesson(c1, s, 'link', 'NASA: Artemis program', 5, { url: 'https://www.nasa.gov/humans-in-space/artemis/', description: 'Explore the latest on humanity’s return to the Moon.', openIn: 'tab' }, { required: false });
    lesson(c1, s, 'live', 'Live Q&A with Dr. Reyes', 45, { startsAt: new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 14) + '00:00.000Z', durationMin: 45, platform: 'Zoom', joinUrl: 'https://zoom.us/', host: 'Dr. Nova Reyes', agenda: 'Bring your hardest orbital-mechanics questions. We will also preview the capstone.' }, { required: false });
    lesson(c1, s, 'assignment', 'Capstone: Plan your mission', 30, { instructions: '## Design a mission profile\n\nChoose a destination (the Moon, Mars, an asteroid…) and write a **one-page mission plan** covering:\n\n1. Mission goal and why it matters\n2. Launch vehicle & trajectory type\n3. Three biggest risks and how you will mitigate them\n\nYou can write directly below, attach a document, or share a link.', maxPoints: 100, allowFile: true, allowText: true });

    /* ═══════ Course 2: Safety (SCORM) ═══════ */
    const c2 = course({
      title: 'Mission-Critical Safety Protocols', subtitle: 'Mandatory flight-readiness and safety training for every crew member.',
      description: 'Required annual training covering pre-flight checks, emergency procedures and reporting. Includes an interactive SCORM module, a policy document and a final assessment.\n\nComplete the lessons in order — each unlocks the next.',
      cat: 'Safety & Compliance', level: 'Beginner', theme: 'ember', instructor: kai, sequential: true, tags: ['compliance', 'safety', 'scorm'],
      objectives: ['Perform a complete pre-flight checklist', 'Recognise and respond to cabin emergencies', 'Know how and when to file a safety report'], days: 50,
    });
    pos = 0;
    s = section(c2, 'Prepare');
    lesson(c2, s, 'page', 'Why safety comes first', 3, { markdown: '# Safety is everyone’s job\n\nEvery incident in the history of spaceflight has taught us something. This module distils those lessons into **three habits**:\n\n- **Check twice** — verify, then verify again\n- **Speak up** — any crew member can call a hold\n- **Write it down** — near-misses are gifts\n\n> “In space, there are no small mistakes — only small chances to fix them early.”' }, { preview: true });
    s = section(c2, 'Pre-flight');
    const l2s = lesson(c2, s, 'scorm', 'Interactive: Pre-flight Safety Checklist', 10, { packageId: scorm.id }, { summary: 'A SCORM 1.2 module — your progress and score are tracked automatically.' });
    lesson(c2, s, 'document', 'Emergency Procedures Reference', 6, { fileId: pdf, allowDownload: true });
    s = section(c2, 'Assessment');
    const l2q = lesson(c2, s, 'quiz', 'Safety certification exam', 10, {
      passScore: 80, maxAttempts: 3, showAnswers: true,
      questions: [
        { id: 'q1', type: 'single', prompt: 'The cabin pressure alarm sounds. What is your first action?', options: o('Remove your helmet', 'Don emergency oxygen and notify Mission Control', 'Wait and monitor', 'Open the airlock'), correct: ['o2'], points: 2 },
        { id: 'q2', type: 'truefalse', prompt: 'Any crew member has the authority to call a hold.', correct: ['true'], points: 1 },
        { id: 'q3', type: 'multiple', prompt: 'Which of these must be on a pre-flight checklist?', options: o('Helmet seal', 'Lunch order', 'Oxygen level', 'Comms check'), correct: ['o1', 'o3', 'o4'], points: 2 },
        { id: 'q4', type: 'short', prompt: 'Name the report you file for an event that did not cause harm but could have (two words).', correct: ['near miss', 'near-miss'], points: 1 },
      ],
    });

    /* ═══════ Course 3: Leadership ═══════ */
    const c3 = course({
      title: 'Leading Remote Crews', subtitle: 'Communication, trust and decision-making when your team is 400 km away.',
      description: 'Leadership lessons from analogue missions, Antarctic stations and distributed teams. Learn how to run effective briefings, give feedback across latency, and keep morale high on long-duration missions.',
      cat: 'Leadership', level: 'Intermediate', theme: 'sunset', instructor: nova, tags: ['leadership', 'communication', 'remote teams'],
      objectives: ['Run a crisp daily briefing', 'Give actionable feedback asynchronously', 'Spot and address team fatigue early', 'Make decisions with incomplete information'], days: 42,
    });
    pos = 0;
    s = section(c3, 'Communication');
    lesson(c3, s, 'video', 'The Egg — a perspective shift', 8, { source: 'youtube', url: 'https://www.youtube.com/watch?v=h6fcK_fRYaI' }, { preview: true, summary: 'A short story that reframes how we see every teammate.' });
    lesson(c3, s, 'page', 'The anatomy of a great briefing', 6, { markdown: '# The 5-minute briefing\n\nA good briefing has a **fixed shape** so everyone can listen for what matters:\n\n1. **Status** — what changed since last time?\n2. **Plan** — what are we doing today and why?\n3. **Risks** — what could go wrong?\n4. **Asks** — who needs to do what?\n5. **Check-in** — one word from each crew member\n\n## Latency-friendly feedback\n\n- Lead with intent, not criticism\n- Be specific and kind\n- End with a clear next step\n' });
    lesson(c3, s, 'embed', 'Interactive: ISS live position', 5, { url: 'https://www.openstreetmap.org/export/embed.html?bbox=-180,-60,180,60&layer=mapnik', height: 480 }, { required: false, summary: 'Embed any web experience — dashboards, maps, forms or interactive demos.' });
    s = section(c3, 'Decisions & morale');
    lesson(c3, s, 'quiz', 'Decision-making scenarios', 8, {
      passScore: 60, maxAttempts: 0, showAnswers: true,
      questions: [
        { id: 'q1', type: 'single', prompt: 'You must decide with 60% of the information available. Best approach?', options: o('Wait until you have everything', 'Decide, state your assumptions, and plan to revisit', 'Delegate it away', 'Flip a coin'), correct: ['o2'], points: 1 },
        { id: 'q2', type: 'ordering', prompt: 'Order the parts of the 5-minute briefing.', options: o('Status', 'Plan', 'Risks', 'Asks', 'Check-in'), points: 2 },
      ],
    });
    lesson(c3, s, 'assignment', 'Reflection: your communication playbook', 25, { instructions: 'Write a short playbook (300 words) describing how **you** will run briefings and give feedback with your own team.', maxPoints: 50, allowFile: false, allowText: true });

    /* ═══════ Course 4: Data & AI ═══════ */
    const c4 = course({
      title: 'Data & AI for Mission Operations', subtitle: 'Turn telemetry into decisions with practical analytics and machine learning.',
      description: 'A hands-on introduction to analysing spacecraft telemetry: cleaning time-series, spotting anomalies, and communicating insights with confidence.',
      cat: 'Data & AI', level: 'Intermediate', theme: 'aurora', instructor: nova, featured: true, tags: ['data', 'ai', 'telemetry', 'python'],
      objectives: ['Clean and resample time-series telemetry', 'Detect anomalies with simple statistics', 'Choose the right chart for the message'], days: 35,
    });
    pos = 0;
    s = section(c4, 'Telemetry basics');
    lesson(c4, s, 'video', 'Symphony of Science: A Glorious Dawn', 4, { source: 'youtube', url: 'https://www.youtube.com/watch?v=zSgiXGELjbc' }, { preview: true });
    lesson(c4, s, 'page', 'Detecting anomalies with z-scores', 9, { markdown: '# Spotting the unusual\n\nA **z-score** tells you how many standard deviations a reading is from the mean.\n\n```python\nimport numpy as np\nvals = np.array([20.1, 20.3, 19.9, 20.2, 27.5, 20.0])\nz = (vals - vals.mean()) / vals.std()\nprint(np.where(abs(z) > 2)[0])  # → [4]\n```\n\n| z-score | Interpretation |\n| --- | --- |\n| < 1 | Normal |\n| 1–2 | Worth a glance |\n| > 2 | Investigate |\n\n- [ ] Always plot the data first\n- [x] Document your thresholds\n' });
    lesson(c4, s, 'link', 'Reference: NumPy documentation', 5, { url: 'https://numpy.org/doc/stable/', description: 'Keep the docs open in a new tab as you practise.', openIn: 'tab' }, { required: false });
    lesson(c4, s, 'quiz', 'Telemetry quiz', 6, { passScore: 70, maxAttempts: 0, showAnswers: true, questions: [
      { id: 'q1', type: 'single', prompt: 'A reading has a z-score of 3.4. What should you do?', options: o('Ignore it', 'Investigate — it is a likely anomaly', 'Delete it', 'Average it away'), correct: ['o2'], points: 1 },
      { id: 'q2', type: 'truefalse', prompt: 'You should plot your data before running statistical tests.', correct: ['true'], points: 1 },
    ] });

    /* ═══════ Course 5: Rocket propulsion ═══════ */
    const c5 = course({
      title: 'Rocket Propulsion 101', subtitle: 'Thrust, specific impulse and the rocket equation, without the headache.',
      description: 'Understand how rockets actually work. We build up from Newton’s third law to staging and delta-v budgets, with worked examples and quizzes.',
      cat: 'Engineering', level: 'Advanced', theme: 'ocean', instructor: kai, tags: ['propulsion', 'physics', 'engineering'],
      objectives: ['Apply the Tsiolkovsky rocket equation', 'Compare chemical and electric propulsion', 'Budget delta-v for a mission'], days: 28,
    });
    pos = 0;
    s = section(c5, 'The rocket equation');
    lesson(c5, s, 'page', 'Tsiolkovsky in one page', 10, { markdown: '# The tyranny of the rocket equation\n\n$$\\Delta v = I_{sp} \\, g_0 \\ln\\frac{m_0}{m_f}$$\n\nIn plain words: to go faster you need **exponentially** more propellant. That is why we stage.\n\n| Engine | Isp (s) |\n| --- | --- |\n| Solid motor | 250 |\n| Kerolox | 330 |\n| Hydrolox | 450 |\n| Ion thruster | 3000+ |\n' }, { preview: true });
    lesson(c5, s, 'video', 'Mission preview', 2, { source: 'upload', fileId: vid }, {});
    lesson(c5, s, 'quiz', 'Propulsion quiz', 8, { passScore: 75, maxAttempts: 0, showAnswers: true, questions: [
      { id: 'q1', type: 'single', prompt: 'Which engine has the highest specific impulse?', options: o('Solid motor', 'Kerolox', 'Hydrolox', 'Ion thruster'), correct: ['o4'], points: 1 },
      { id: 'q2', type: 'short', prompt: 'What does the “I” in Isp stand for (one word)?', correct: ['impulse'], points: 1 },
    ] });

    /* ═══════ Course 6: Design ═══════ */
    const c6 = course({
      title: 'Designing for Zero Gravity', subtitle: 'Human-centred design when up is a matter of opinion.',
      description: 'How do you design a handle, a screen, or a whole habitat when there is no floor? Explore ergonomics, wayfinding and interface design for microgravity.',
      cat: 'Design', level: 'Beginner', theme: 'lunar', instructor: nova, tags: ['design', 'ux', 'ergonomics'],
      objectives: ['Apply human-factors principles in microgravity', 'Prototype a wayfinding system', 'Critique interfaces for glove-friendly use'], days: 20,
    });
    pos = 0;
    s = section(c6, 'Principles');
    lesson(c6, s, 'page', 'Up is a matter of opinion', 6, { markdown: '# Designing without a floor\n\nOn the ISS, **orientation cues** matter. Designers use consistent *"floor"* colours, labels and lighting to help crews orient quickly.\n\n## Three rules\n\n1. Make controls reachable from any posture\n2. Use large, glove-friendly targets (≥ 15 mm)\n3. Never rely on colour alone\n' }, { preview: true });
    lesson(c6, s, 'document', 'Human Factors Checklist', 4, { fileId: pdf, allowDownload: true });
    lesson(c6, s, 'quiz', 'Design check', 4, { passScore: 50, maxAttempts: 0, showAnswers: true, questions: [
      { id: 'q1', type: 'truefalse', prompt: 'Relying on colour alone is a good way to convey status.', correct: ['false'], points: 1 },
    ] });

    /* ═══════ Course 7: Draft ═══════ */
    const c7 = course({ title: 'Lunar Base Operations', subtitle: 'Coming soon: running a permanent presence on the Moon.', description: 'Draft course — in development.', cat: 'Engineering', level: 'Advanced', theme: 'forest', instructor: kai, status: 'draft', tags: ['moon'], objectives: [], days: 3 });
    pos = 0;
    s = section(c7, 'Overview');
    lesson(c7, s, 'page', 'Course outline', 3, { markdown: '# Lunar Base Operations\n\n_Work in progress._' });

    /* ── learning path ── */
    const pathId = q.run(`INSERT INTO paths(title, description, theme, status) VALUES (?,?,?,?)`, 'Astronaut Core Training', 'The essential curriculum for every new crew member: science fundamentals, safety certification and leadership.', 'nova', 'published').id;
    [c1, c2, c3].forEach((c, i) => q.run('INSERT INTO path_courses(path_id, course_id, position) VALUES (?,?,?)', pathId, c, i));
    const path2 = q.run(`INSERT INTO paths(title, description, theme, status) VALUES (?,?,?,?)`, 'Mission Analyst Track', 'Data, propulsion and design skills for the analysts behind every launch.', 'aurora', 'published').id;
    [c4, c5, c6].forEach((c, i) => q.run('INSERT INTO path_courses(path_id, course_id, position) VALUES (?,?,?)', path2, c, i));
    for (const u of [demo, learners[1], learners[2]]) q.run('INSERT INTO path_enrollments(path_id, user_id) VALUES (?,?)', pathId, u);

    /* ── groups ── */
    const all = q.run(`INSERT INTO groups(name, description, color) VALUES (?,?,?)`, 'All Astronauts', 'Every learner on the platform — used for mandatory training.', 'violet').id;
    for (const u of learners) q.run('INSERT INTO group_members(group_id, user_id) VALUES (?,?)', all, u);
    q.run('INSERT INTO group_courses(group_id, course_id, due_days) VALUES (?,?,?)', all, c2, 21);
    const ops = q.run(`INSERT INTO groups(name, description, color) VALUES (?,?,?)`, 'Mission Control Team', 'Operations specialists who run day-to-day missions.', 'cyan').id;
    for (const u of learners.filter((_, i) => i % 3 === 0)) q.run('INSERT INTO group_members(group_id, user_id) VALUES (?,?)', ops, u);
    q.run('INSERT INTO group_courses(group_id, course_id, due_days) VALUES (?,?,?)', ops, c4, 30);

    /* ── enrollments + simulated progress ── */
    const published = [c1, c2, c3, c4, c5, c6];
    const requiredOf = (cid: number) => q.all('SELECT * FROM lessons WHERE course_id=? AND required=1 ORDER BY position', cid);
    const enrollPlan = new Map<number, { cid: number; frac: number }[]>();
    enrollPlan.set(demo, [{ cid: c1, frac: 0.55 }, { cid: c2, frac: 0.35 }, { cid: c4, frac: 1 }, { cid: c3, frac: 0.15 }]);
    learners.slice(1).forEach((u) => {
      const n = 2 + Math.floor(rnd() * 3);
      const chosen = [...published].sort(() => rnd() - 0.5).slice(0, n);
      enrollPlan.set(u, chosen.map((cid) => ({ cid, frac: pick([0, 0.2, 0.4, 0.6, 0.8, 1, 1]) })));
    });
    for (const [uid, plan] of enrollPlan) {
      for (const { cid, frac } of plan) {
        const daysAgo = uid === demo ? 14 - Math.floor(rnd() * 8) : 1 + Math.floor(rnd() * 28);
        ensureEnrollment(uid, cid, cid === c2 ? 'group' : 'self', null, cid === c2 ? new Date(Date.now() + (uid === demo ? 6 : 15) * 864e5).toISOString().slice(0, 10) : null);
        q.run('UPDATE enrollments SET enrolled_at=? WHERE user_id=? AND course_id=?', dayAgo(daysAgo), uid, cid);
        const req = requiredOf(cid);
        const doneN = Math.round(req.length * frac);
        req.slice(0, doneN).forEach((l, i) => {
          const type = String(l.type);
          if (type === 'assignment') {
            q.run(`INSERT OR IGNORE INTO submissions(user_id, lesson_id, text, status, grade, feedback, submitted_at, graded_at, graded_by) VALUES (?,?,?,?,?,?,?,?,?)`, uid, l.id, 'Here is my mission plan: a crewed lunar flyby using a free-return trajectory, with risk mitigation for radiation exposure, comms blackout and life-support redundancy.', 'graded', 82, 'Strong plan! Next time quantify the radiation budget.', dayAgo(Math.max(0, daysAgo - 1)), dayAgo(Math.max(0, daysAgo - 1)), nova);
          }
          if (type === 'quiz') {
            const pct = pick([80, 90, 100, 100]);
            q.run('INSERT INTO quiz_attempts(user_id, lesson_id, answers, results, score, max_score, percent, passed, duration_sec, submitted_at) VALUES (?,?,?,?,?,?,?,?,?,?)', uid, l.id, '{}', '[]', pct / 10, 10, pct, 1, 120 + Math.floor(rnd() * 200), dayAgo(Math.max(0, daysAgo - 1)));
          }
          markLessonComplete(uid, l, { score: type === 'quiz' ? 90 : null });
          const when = dayAgo(Math.max(0, daysAgo - Math.floor((i / Math.max(1, req.length)) * daysAgo)), 8 + Math.floor(rnd() * 10));
          q.run('UPDATE lesson_progress SET completed_at=?, updated_at=?, time_spent=? WHERE user_id=? AND lesson_id=?', when, when, 240 + Math.floor(rnd() * 900), uid, l.id);
        });
        if (doneN > 0) q.run('UPDATE enrollments SET last_accessed_at=?, last_lesson_id=? WHERE user_id=? AND course_id=?', dayAgo(Math.floor(rnd() * 3)), req[Math.min(doneN, req.length - 1)].id, uid, cid);
        const done = q.get(`SELECT status FROM enrollments WHERE user_id=? AND course_id=?`, uid, cid)!;
        if (done.status === 'completed') {
          const when = dayAgo(Math.max(0, daysAgo - 3));
          q.run('UPDATE enrollments SET completed_at=? WHERE user_id=? AND course_id=?', when, uid, cid);
          q.run('UPDATE certificates SET issued_at=? WHERE user_id=? AND course_id=?', when, uid, cid);
        }
      }
    }
    // the demo learner has a pending submission on c1 to showcase grading state, and an in-progress SCORM record
    q.run(`INSERT OR REPLACE INTO scorm_tracking(user_id, lesson_id, data) VALUES (?,?,?)`, demo, l2s, JSON.stringify({ 'cmi.core.lesson_status': 'incomplete', 'cmi.core.lesson_location': '1', 'cmi.suspend_data': '{"step":1}' }));
    for (const u of learners.slice(1, 5)) {
      const a = q.get(`SELECT id FROM lessons WHERE course_id=? AND type='assignment'`, c1)!;
      if (!q.get('SELECT 1 x FROM submissions WHERE user_id=? AND lesson_id=?', u, a.id) && q.get('SELECT 1 x FROM enrollments WHERE user_id=? AND course_id=?', u, c1))
        q.run(`INSERT INTO submissions(user_id, lesson_id, text, status, submitted_at) VALUES (?,?,?,?,?)`, u, a.id, 'Mission: Mars sample return. Launch on a heavy-lift vehicle with a Hohmann transfer; main risks are dust storms, comms delay and life-support redundancy.', 'submitted', dayAgo(Math.floor(rnd() * 3)));
    }
    void l2q; void l1a; void l1b;

    /* ── reviews, discussions, notes ── */
    const reviewTexts = ['Brilliant course — clear, concise and genuinely fun.', 'Loved the interactive pieces. The quizzes were a good challenge.', 'Great pacing. I would love an advanced follow-up!', 'Very practical. Used the briefing template with my team the next day.', 'Solid content, some lessons felt short.'];
    for (const e of q.all(`SELECT user_id, course_id FROM enrollments WHERE status='completed' OR progress >= 60`)) if (rnd() > 0.35) q.run('INSERT OR IGNORE INTO reviews(course_id, user_id, rating, body, created_at) VALUES (?,?,?,?,?)', e.course_id, e.user_id, pick([4, 5, 5, 5, 4, 3]), pick(reviewTexts), dayAgo(Math.floor(rnd() * 20)));
    const lessonInC1 = q.all('SELECT id, title FROM lessons WHERE course_id=? ORDER BY position', c1);
    const t1 = q.run('INSERT INTO discussions(course_id, lesson_id, user_id, body, created_at, pinned) VALUES (?,?,?,?,?,1)', c1, lessonInC1[0].id, nova, 'Welcome, everyone! 👋 Introduce yourself here and tell us which mission you dream of joining. I read every reply.', dayAgo(30)).id;
    q.run('INSERT INTO discussions(course_id, user_id, parent_id, body, created_at) VALUES (?,?,?,?,?)', c1, learners[2], t1, 'Hi all! Mars sample return is my dream mission 🔴', dayAgo(28));
    q.run('INSERT INTO discussions(course_id, user_id, parent_id, body, created_at) VALUES (?,?,?,?,?)', c1, demo, t1, 'Excited to be here — the Artemis program is what got me into this.', dayAgo(12));
    const t2 = q.run('INSERT INTO discussions(course_id, lesson_id, user_id, body, created_at) VALUES (?,?,?,?,?)', c1, lessonInC1[5]?.id ?? lessonInC1[0].id, learners[3], 'Quick question on Kepler’s third law: does it hold for elliptical orbits using the semi-major axis?', dayAgo(9)).id;
    q.run('INSERT INTO discussions(course_id, user_id, parent_id, body, created_at) VALUES (?,?,?,?,?)', c1, nova, t2, 'Exactly right — use the semi-major axis `a` and it works for any ellipse. Great catch!', dayAgo(8));
    q.run('INSERT INTO notes(user_id, lesson_id, body) VALUES (?,?,?)', demo, lessonInC1[1].id, 'Keyboard shortcut cheat-sheet: J/K to navigate, C to complete.');

    /* ── announcements ── */
    q.run('INSERT INTO announcements(title, body, audience, pinned, author_id, created_at) VALUES (?,?,?,?,?,?)', 'Welcome to Orbit Ignite 🚀', 'Our new learning platform is live! Explore the catalog, join a learning path and start earning XP. Need help? Ask Comet, our mascot, in the help menu.', 'all', 1, admin, dayAgo(6));
    q.run('INSERT INTO announcements(title, body, audience, pinned, author_id, created_at) VALUES (?,?,?,?,?,?)', 'Annual safety training is due', 'All crew must complete Mission-Critical Safety Protocols by the due date shown on your dashboard.', 'course', 0, admin, dayAgo(2));
    q.run('UPDATE announcements SET target_id=? WHERE audience=\'course\'', c2);
    q.run('INSERT INTO notifications(user_id, type, title, body, link, created_at) VALUES (?,?,?,?,?,?)', demo, 'assignment', 'New mission assigned: Mission-Critical Safety Protocols', 'Due in 6 days', `/courses/${c2}`, dayAgo(1));
    q.run('INSERT INTO notifications(user_id, type, title, body, link, created_at) VALUES (?,?,?,?,?,?)', demo, 'announcement', 'Welcome to Orbit Ignite 🚀', 'Our new learning platform is live!', '/', dayAgo(0));
    q.run('INSERT INTO activity(user_id, action, entity, entity_id, meta, created_at) VALUES (?,?,?,?,?,?)', admin, 'settings.updated', 'settings', null, '{}', dayAgo(5));
  });
  console.log(`✅ Seeded. Sign in with  admin@orbit.space / ${DEMO_PASSWORD}  ·  nova@orbit.space  ·  astro@orbit.space`);
}
