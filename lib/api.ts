const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000").replace(/\/$/, "") + "/api";

/** Backend root URL from env (NEXT_PUBLIC_API_BASE_URL). Use for webhook/orchestration URLs. */
export function getBackendBaseUrl(): string {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
  return String(base).replace(/\/+$/, "");
}

export type ApiError = {
  message: string;
  status?: number;
};

async function handleResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  let data: T;
  try {
    data = text ? (JSON.parse(text) as T) : ({} as T);
  } catch {
    data = { message: text || res.statusText } as unknown as T;
  }
  if (!res.ok) {
    const err = data as unknown as { message?: string };
    throw {
      message: err?.message || res.statusText || "Request failed",
      status: res.status,
    } as ApiError;
  }
  return data;
}

function mergeHeaders(extra?: Record<string, string>): Record<string, string> {
  const base: Record<string, string> = { "Content-Type": "application/json" };
  if (extra) Object.assign(base, extra);
  return base;
}

export async function apiGet<T>(path: string, params?: Record<string, string>, headers?: Record<string, string>): Promise<T> {
  const fullPath = path.startsWith("http") ? path : `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
  const url = new URL(fullPath);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v != null && v !== "") url.searchParams.set(k, v);
    });
  }
  const res = await fetch(url.toString(), {
    method: "GET",
    headers: mergeHeaders(headers),
    cache: "no-store",
  });
  return handleResponse<T>(res);
}

export async function apiPost<T>(path: string, body?: unknown, headers?: Record<string, string>): Promise<T> {
  const url = path.startsWith("http") ? path : `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, {
    method: "POST",
    headers: mergeHeaders(headers),
    body: body != null ? JSON.stringify(body) : undefined,
  });
  return handleResponse<T>(res);
}

export async function apiPut<T>(path: string, body?: unknown, headers?: Record<string, string>): Promise<T> {
  const url = path.startsWith("http") ? path : `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: mergeHeaders(headers),
    body: body != null ? JSON.stringify(body) : undefined,
  });
  return handleResponse<T>(res);
}

export { API_BASE };
