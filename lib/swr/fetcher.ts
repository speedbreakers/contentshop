export class FetchError extends Error {
  status: number;
  info?: unknown;

  constructor(message: string, status: number, info?: unknown) {
    super(message);
    this.name = 'FetchError';
    this.status = status;
    this.info = info;
  }
}

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

async function safeParseJson(res: Response): Promise<JsonValue | null> {
  try {
    return (await res.json()) as JsonValue;
  } catch {
    return null;
  }
}

/**
 * Opinionated JSON fetch helper for SWR + client-side API calls.
 *
 * - Throws on non-2xx, with `status` + optional parsed JSON body.
 * - Assumes JSON responses (common for Next route handlers).
 */
export async function fetchJson<T>(
  url: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(url, {
    credentials: 'include',
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    const info = await safeParseJson(res);
    const message =
      (info && typeof info === 'object' && 'error' in info && typeof (info as any).error === 'string'
        ? (info as any).error
        : null) ?? `Request failed (HTTP ${res.status})`;
    throw new FetchError(message, res.status, info);
  }

  // Handle 204 No Content
  if (res.status === 204) return undefined as T;

  return (await res.json()) as T;
}

export const swrFetcher = <T,>(url: string) => fetchJson<T>(url);


