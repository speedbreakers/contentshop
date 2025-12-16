export function resolveUrl(origin: string, maybeRelative: string) {
  if (!maybeRelative) return maybeRelative;
  if (maybeRelative.startsWith('http://') || maybeRelative.startsWith('https://')) return maybeRelative;
  if (maybeRelative.startsWith('/')) return `${origin}${maybeRelative}`;
  return maybeRelative;
}

export async function fetchAsBytes(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`Failed to fetch image: HTTP ${res.status}`);
  const mimeType = res.headers.get('content-type') ?? 'application/octet-stream';
  const ab = await res.arrayBuffer();
  return { bytes: new Uint8Array(ab), mimeType };
}

export function buildSameOriginAuthHeaders(args: {
  requestOrigin: string;
  url: string;
  cookie?: string | null;
}) {
  const cookie = args.cookie ?? '';
  if (!cookie) return undefined;
  // Only attach cookies to same-origin requests (avoid leaking cookies to external URLs).
  if (args.url.startsWith(args.requestOrigin)) {
    return { cookie };
  }
  return undefined;
}

export function coerceResultFileToBytes(file: any): { bytes: Uint8Array; mimeType: string } {
  const mimeType = file?.mediaType ?? file?.mimeType ?? 'image/png';
  if (typeof file?.base64 === 'string') {
    return { bytes: new Uint8Array(Buffer.from(file.base64, 'base64')), mimeType };
  }
  if (file?.data instanceof Uint8Array) {
    return { bytes: file.data, mimeType };
  }
  if (file?.data && typeof file.data === 'object' && typeof file.data.length === 'number') {
    return { bytes: new Uint8Array(file.data), mimeType };
  }
  throw new Error('Unsupported result.files entry (no base64/data)');
}


