export class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch('/api' + url, {
      method,
      credentials: 'same-origin',
      headers: { 'X-Requested-With': 'orbit', ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Check your connection and try again.');
  }
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    /* not json */
  }
  if (!res.ok) {
    if (res.status === 401 && !url.startsWith('/auth/')) window.dispatchEvent(new Event('orbit:unauthorized'));
    throw new ApiError(res.status, data?.error || res.statusText || 'Request failed', data?.code);
  }
  return data as T;
}

export const api = {
  get: <T = any>(url: string) => request<T>('GET', url),
  post: <T = any>(url: string, body: unknown = {}) => request<T>('POST', url, body),
  put: <T = any>(url: string, body: unknown = {}) => request<T>('PUT', url, body),
  patch: <T = any>(url: string, body: unknown = {}) => request<T>('PATCH', url, body),
  del: <T = any>(url: string) => request<T>('DELETE', url),
};

export interface UploadedFile {
  id: number;
  name: string;
  mime: string;
  size: number;
  kind: string;
  url: string;
  createdAt?: string;
}

/** Multipart upload with progress (XHR, since fetch has no upload progress). */
export function upload<T = UploadedFile>(endpoint: '/files' | '/files/scorm', file: File, onProgress?: (pct: number) => void, extra: Record<string, string> = {}): { promise: Promise<T>; abort: () => void } {
  const xhr = new XMLHttpRequest();
  const promise = new Promise<T>((resolve, reject) => {
    xhr.open('POST', '/api' + endpoint);
    xhr.setRequestHeader('X-Requested-With', 'orbit');
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      let data: any = null;
      try {
        data = JSON.parse(xhr.responseText);
      } catch {}
      if (xhr.status >= 200 && xhr.status < 300) resolve(data as T);
      else reject(new ApiError(xhr.status, data?.error || 'Upload failed'));
    };
    xhr.onerror = () => reject(new ApiError(0, 'Upload failed. Check your connection.'));
    xhr.onabort = () => reject(new ApiError(0, 'Upload cancelled'));
    const fd = new FormData();
    for (const [k, v] of Object.entries(extra)) fd.append(k, v);
    fd.append('file', file);
    xhr.send(fd);
  });
  return { promise, abort: () => xhr.abort() };
}
