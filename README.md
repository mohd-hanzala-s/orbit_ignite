<div align="center">

# 🚀 Orbit Ignite

**A space-themed learning management system — beautiful for learners, powerful for admins.**

Host videos, SCORM packages, documents, audio, quizzes, assignments, live sessions and web embeds in one place.
Meet **Comet**, the astro-cat mascot who guides everyone through the mission.

![Dashboard](docs/screenshots/dashboard.png)

</div>

---

## Contents

- [Quick start](#quick-start) · [Demo accounts](#demo-accounts) · [Features](#features) · [Content formats](#content-formats)
- [SCORM](#scorm) · [Architecture](#architecture) · [Configuration](#configuration) · [Deploying](#deploying)
- [Testing](#testing) · [Design system & credits](#design-system--credits) · [Limitations](#known-limitations)

## Quick start

Requires **Node.js ≥ 22.13** (uses the built-in `node:sqlite`, so there are no native modules to compile).

```bash
npm install
npm run dev        # API on :4000, web app on http://localhost:5173
```

The first start creates `./data/` and seeds a demo universe (7 courses, a learning path, 16 people, progress history,
certificates, a real SCORM 1.2 package, a video, audio and a PDF). For a **real deployment** start clean instead:
`SEED_DEMO=0 ADMIN_EMAIL=you@company.com ADMIN_PASSWORD='…' npm start` creates a single administrator and nothing else.
(`npm run seed -- --force` wipes the database and re-creates the demo data.)

Production build:

```bash
npm run build && npm start     # serves the app + API on http://localhost:4000
# or
docker build -t orbit-ignite . && docker run -p 4000:4000 -v orbit-data:/data orbit-ignite
```

### Demo accounts

All demo accounts use the password **`Orbit123!`** (click the chips on the sign-in page to autofill).

| Role | Email | What you can do |
| --- | --- | --- |
| Learner | `astro@orbit.space` | Catalog, player, quizzes, SCORM, certificates, achievements |
| Instructor | `nova@orbit.space` | Build/own courses, grade assignments, see own reports |
| Admin | `admin@orbit.space` | Everything: users, groups, paths, library, reports, settings |

> ⚠️ Change or delete the demo accounts before exposing an instance to the internet.

## Features

### For learners — *Launchpad*
- **Dashboard** with level/XP, streaks, weekly activity, due dates, live sessions and announcements
- **Catalog** with search, category chips, level & sort filters, save-for-later and ratings/reviews
- **Course player**: collapsible curriculum, progress tracking, resume where you left off, keyboard shortcuts (`J`/`K`/`C`), private **notes** (time-stamped on video/audio), per-lesson **discussion**, transcripts, captions, playback speed
- **Quizzes**: single / multiple choice, true-false, short answer, drag-to-order; timers, attempt limits, instant grading with explanations
- **Assignments**: text, link and file submissions → instructor feedback & grade → revision requests
- **Gamification**: XP, levels, 12 badges, daily streaks, leaderboard
- **Certificates** with unique IDs, print/PDF output and a public **verification page** (`/verify/<code>`)
- **Learning paths** ("Constellations"), calendar of live sessions & deadlines (+ `.ics` export), notifications, `⌘K` command palette, dark (Deep Space) and light (Lunar) themes

### For admins & instructors — *Mission Control*
- **Overview** dashboard: KPIs, 30-day enrollment/completion trends, category mix, top courses, activity feed
- **Course builder**: drag-and-drop sections & lessons, 10 lesson types, Markdown editor with live preview, quiz builder, custom or procedural cover art, publish/draft/archive, duplicate, sequential unlock, certificates on/off, invite-only enrollment
- **Users**: create/edit/deactivate/delete, roles, CSV bulk import, per-user detail drawer
- **Groups**: cohorts that auto-enroll members (including future joiners) with due dates
- **Enrollments**: assign individuals or groups, due dates, reset progress, remove
- **Learning paths**, **content library** (every file & SCORM package), **grading queue**, **announcements** (targeted + notifications), **categories**, **platform settings**, **audit log**
- **Reports** by course and learner with one-click **CSV export**
- Role separation: instructors only see and edit their own courses, learners and submissions

## Content formats

| Type | What it hosts |
| --- | --- |
| **Video** | Upload (MP4/WebM/MOV…), **YouTube** (ended-detection via the IFrame API), **Vimeo**, **Loom**, direct URLs and **HLS** streams; WebVTT captions; resume position; speed control |
| **Audio** | MP3, WAV, M4A, OGG, FLAC — upload or URL, with transcript |
| **Document** | **PDF** & images (inline), **.docx** (converted to HTML), text/Markdown/CSV/JSON (rendered); PPT/XLS/others download; or any hosted document URL |
| **SCORM** | SCORM **1.2** and **2004** ZIP packages with full runtime & tracking |
| **Reading page** | Rich Markdown (GFM tables, task lists, code blocks) |
| **Link** | External resource card (new tab) or inline iframe |
| **Embed** | Any frameable web page — dashboards, Figma, Miro, Google Slides/Forms, H5P hosted elsewhere |
| **Quiz** | 5 question types, auto-graded |
| **Assignment** | Text/link/file submission with manual grading |
| **Live session** | Date/time, join link, agenda, countdown "departure board", calendar invite, recording link |

## SCORM

Upload a SCORM ZIP on a SCORM lesson (or in **Content library**). The server validates it, finds the launch file from
`imsmanifest.xml`, detects the version, and extracts it (zip-slip protected). In the player the package runs in a
same-origin sandboxed iframe while the player exposes the standard runtime on the parent window:

- SCORM 1.2 `window.API` — `LMSInitialize/Finish/GetValue/SetValue/Commit/GetLastError…`
- SCORM 2004 `window.API_1484_11` — `Initialize/Terminate/GetValue/SetValue/Commit…`

CMI data (status, score, bookmark, suspend data, session time) is saved on commit and on exit, resumed on the next
launch, and the lesson completes automatically when the SCO reports `completed` / `passed`.
A working demo package is seeded: *Mission-Critical Safety Protocols → Pre-flight Safety Checklist*.

## Architecture

```
orbit_ignite/
├─ server/                Express 5 + node:sqlite (TypeScript, run with tsx)
│  ├─ routes/             auth · catalog · learn (player, quiz, SCORM, notes, discussion) · me · admin · authoring · files
│  ├─ services/           learning (progress, XP, badges, quiz grading) · courses · scorm (manifest parsing/extraction)
│  ├─ seed*.ts            demo universe + generated SCORM package   ·   tests/  API integration tests
├─ shared/                constants shared by client & server (lesson types, XP rules, level curve)
├─ src/                   React 19 · Vite · Tailwind v4 · TanStack Query · Motion · Radix UI
│  ├─ components/space/   Mascot (SVG), logo, starfield, procedural planet covers, progress rings
│  ├─ components/mp|cp/   vendored motion-primitives & Componentry components
│  ├─ components/player/  video · audio · document · SCORM · quiz · assignment · live viewers
│  ├─ components/admin/   uploader, lesson editor, quiz builder, Markdown editor, tables
│  └─ pages/              learner pages, course player, pages/admin/*
├─ e2e/                   Playwright flows (learner + admin) that run against a throw-away production build
└─ data/                  (git-ignored) SQLite DB, uploads, extracted SCORM
```

**Security notes** — passwords hashed with scrypt; opaque server-side sessions in an `HttpOnly`, `SameSite=Lax` cookie;
state-changing requests must carry `X-Requested-With` (CSRF defence in depth); role checks on every admin route and
per-course ownership for instructors; uploads served with `nosniff` and a sandbox CSP (except media/PDF); CSV exports
neutralise spreadsheet formulas; login attempts are throttled; quiz answers never leave the server before submission.
SCORM packages run same-origin by necessity — only let trusted staff upload them.

## Configuration

Copy `.env.example` to `.env`. Everything is optional:

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `4000` | API / production web port |
| `DATA_DIR` | `./data` | SQLite DB, uploads, SCORM |
| `COOKIE_SECURE` | – | Set to `1` behind HTTPS |
| `MAX_UPLOAD_MB` | `1024` | Upload size limit |
| `SEED_DEMO` | – | `0` = skip demo data, create one admin on first run |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | `admin@example.com` / random | Credentials for that first admin |

Platform name, tagline, certificate signer and open registration are editable in **Admin → Settings**.

## Deploying

Run behind an HTTPS reverse proxy (Caddy, nginx, a platform load-balancer) with `COOKIE_SECURE=1`, persist `DATA_DIR`
on a volume (the provided `Dockerfile` uses `/data`), and back up that directory. The app is a single Node process
with an embedded database — ideal for small and mid-size deployments; see limitations for scaling out.

## Testing

```bash
npm run typecheck   # app + server
npm test            # 11 API integration tests (auth, RBAC, enrollment, SCORM, quizzes, grading, authoring, files…)
npm run e2e         # headless-browser flows: learner journey incl. SCORM & quiz, admin course building, drag-reorder
```

`npm run e2e` expects Playwright's Chromium at `/opt/pw-browsers` (see `e2e/run.sh`); set the path in the scripts if yours differs.

## Design system & credits

- **Visuals**: deep-space gradients, a parallax starfield, glass surfaces, procedural planet cover art (unique per course) and **Comet** the SVG astro-cat mascot with moods (idle, wave, happy, cheer, think, sleep, oops).
- **[motion-primitives.com](https://motion-primitives.com)** components (MIT): `TextEffect`, `TextLoop`, `AnimatedBackground`, `AnimatedNumber`, `Spotlight`, `BorderTrail`, `Tilt`, `Magnetic`, `InfiniteSlider` (vendored in `src/components/mp`).
- **[componentry.dev](https://componentry.dev)** components: `SplitFlapDisplay` (live-session countdown) and `MagnetLines` (sign-in hero) (vendored in `src/components/cp`).
- **[Skiper UI](https://skiper-ui.com)**: its component registry is license-gated, so no code was copied — it served as design inspiration for the polished, motion-rich look.
- **manua.im** did not resolve; `manu.im` currently serves only a "coming soon" page, so nothing was taken from it.
- Fonts: Inter, Space Grotesk, JetBrains Mono (via `@fontsource`, self-hosted). Icons: Lucide. Primitives: Radix UI, cmdk, sonner.

## Known limitations

- Single-node by design (SQLite + local disk). For horizontal scaling swap `server/db.ts` for Postgres and the upload directory for object storage.
- No outbound email — notifications are in-app; password resets are done by an admin (Admin → Users → Edit).
- PowerPoint/Excel files are offered as downloads (no in-browser rendering); xAPI/cmi5 and LTI are not implemented.
- YouTube/Vimeo/Loom playback and external embeds need internet access from the learner's browser.

## License

MIT
