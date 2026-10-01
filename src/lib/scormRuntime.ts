/**
 * Browser-side SCORM runtime. Exposes the SCORM 1.2 `API` and SCORM 2004 `API_1484_11` objects
 * on the player window so a SCO in a same-origin iframe can discover them by walking `window.parent`.
 */
export interface ScormHandle { destroy: () => void; flush: () => Promise<void> }

type Cmi = Record<string, string>;

export function mountScorm(opts: {
  lessonId: number;
  version: '1.2' | '2004';
  initial: Cmi;
  student: { id: string; name: string };
  tracked: boolean;
  onResult: (r: { completed: boolean; status: string; result?: any }) => void;
}): ScormHandle {
  const { lessonId, version, student, tracked } = opts;
  const is12 = version === '1.2';
  const data: Cmi = { ...opts.initial };
  const dirty = new Set<string>();
  let initialized = false;
  let lastError = '0';
  let timer: ReturnType<typeof setTimeout> | null = null;
  const started = Date.now();

  const defaults: Cmi = is12
    ? { 'cmi.core.student_id': student.id, 'cmi.core.student_name': student.name, 'cmi.core.credit': 'credit', 'cmi.core.lesson_mode': 'normal', 'cmi.core.lesson_status': 'not attempted', 'cmi.core.entry': 'ab-initio', 'cmi.core.score.min': '', 'cmi.core.score.max': '', 'cmi.core.score.raw': '', 'cmi.launch_data': '', 'cmi.core.lesson_location': '', 'cmi.suspend_data': '' }
    : { 'cmi.learner_id': student.id, 'cmi.learner_name': student.name, 'cmi.credit': 'credit', 'cmi.mode': 'normal', 'cmi.completion_status': 'unknown', 'cmi.success_status': 'unknown', 'cmi.entry': 'ab-initio', 'cmi._version': '1.0', 'cmi.location': '', 'cmi.suspend_data': '', 'cmi.scaled_passing_score': '' };
  for (const [k, v] of Object.entries(defaults)) if (!(k in data)) data[k] = v;
  const statusKey = is12 ? 'cmi.core.lesson_status' : 'cmi.completion_status';
  if (data[statusKey] && !['not attempted', 'unknown'].includes(data[statusKey])) data[is12 ? 'cmi.core.entry' : 'cmi.entry'] = 'resume';

  const readOnly = new Set(is12 ? ['cmi.core.student_id', 'cmi.core.student_name', 'cmi.core.credit', 'cmi.core.entry', 'cmi.core.lesson_mode', 'cmi.launch_data'] : ['cmi.learner_id', 'cmi.learner_name', 'cmi.credit', 'cmi.entry', 'cmi.mode', 'cmi._version']);

  const send = async (keepalive = false) => {
    if (!tracked || dirty.size === 0) return;
    const payload: Cmi = {};
    for (const k of dirty) payload[k] = data[k];
    dirty.clear();
    try {
      const res = await fetch(`/api/lessons/${lessonId}/scorm`, { method: 'POST', credentials: 'same-origin', keepalive, headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'orbit' }, body: JSON.stringify({ cmi: payload }) });
      if (res.ok) {
        const j = await res.json();
        opts.onResult({ completed: !!j.completed, status: j.status, result: j.result });
      }
    } catch { for (const k of Object.keys(payload)) dirty.add(k); }
  };
  const schedule = () => { if (timer) clearTimeout(timer); timer = setTimeout(() => send(), 1500); };

  const fmtSession = () => {
    const s = Math.round((Date.now() - started) / 1000);
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    return is12 ? `${String(h).padStart(4, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `PT${h}H${m}M${sec}S`;
  };

  const get = (k: string) => {
    lastError = '0';
    if (k === 'cmi.core._children') return 'student_id,student_name,lesson_location,credit,lesson_status,entry,score,total_time,lesson_mode,exit,session_time';
    if (k === 'cmi.core.score._children') return 'raw,min,max';
    if (k === 'cmi._children') return 'core,suspend_data,launch_data';
    if (k in data) return data[k];
    if (k.endsWith('._count')) return '0';
    if (k === 'cmi.core.total_time' || k === 'cmi.total_time') return is12 ? '0000:00:00' : 'PT0S';
    lastError = is12 ? '201' : '401';
    return '';
  };
  const set = (k: string, v: unknown) => {
    lastError = '0';
    if (!initialized) { lastError = is12 ? '301' : '132'; return 'false'; }
    if (readOnly.has(k)) { lastError = is12 ? '403' : '404'; return 'false'; }
    if (!k.startsWith('cmi.')) { lastError = is12 ? '201' : '401'; return 'false'; }
    data[k] = String(v);
    dirty.add(k);
    // SCORM 2004: derive a score from scaled/raw so the LMS summary works with either
    schedule();
    return 'true';
  };

  const finish = () => {
    if (!initialized) { lastError = is12 ? '301' : '112'; return 'false'; }
    const sk = is12 ? 'cmi.core.session_time' : 'cmi.session_time';
    if (!dirty.has(sk)) { data[sk] = fmtSession(); dirty.add(sk); }
    initialized = false;
    void send(true);
    return 'true';
  };

  const api12 = {
    LMSInitialize: () => { initialized = true; lastError = '0'; return 'true'; },
    LMSFinish: finish,
    LMSGetValue: get,
    LMSSetValue: set,
    LMSCommit: () => { if (timer) clearTimeout(timer); void send(); return 'true'; },
    LMSGetLastError: () => lastError,
    LMSGetErrorString: (c: string) => ({ '0': 'No error', '201': 'Invalid argument error', '301': 'Not initialized', '403': 'Element is read only' } as Record<string, string>)[c] ?? 'Error',
    LMSGetDiagnostic: (c: string) => c,
  };
  const api2004 = {
    Initialize: () => { initialized = true; lastError = '0'; return 'true'; },
    Terminate: finish,
    GetValue: get,
    SetValue: set,
    Commit: api12.LMSCommit,
    GetLastError: () => lastError,
    GetErrorString: (c: string) => ({ '0': 'No error', '401': 'Undefined data model element', '404': 'Read only', '132': 'Store before initialize' } as Record<string, string>)[c] ?? 'Error',
    GetDiagnostic: (c: string) => c,
  };
  const w = window as any;
  // expose both so SCOs written for either generation still find an API
  w.API = api12;
  w.API_1484_11 = api2004;

  return {
    destroy: () => { if (timer) clearTimeout(timer); if (initialized) finish(); else void send(true); delete w.API; delete w.API_1484_11; },
    flush: () => send(),
  };
}
