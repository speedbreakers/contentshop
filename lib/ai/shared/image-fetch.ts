export function resolveUrl(origin: string, maybeRelative: string) {
  if (!maybeRelative) return maybeRelative;
  if (maybeRelative.startsWith('http://') || maybeRelative.startsWith('https://')) return maybeRelative;
  if (maybeRelative.startsWith('/')) return `${origin}${maybeRelative}`;
  return maybeRelative;
}

function isLocalhostHost(host: string) {
  const h = host.toLowerCase();
  return h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || h === '::1' || h === '0.0.0.0';
}

function downgradeHttpsToHttpIfLocalhost(url: string) {
  try {
    const u = new URL(url);
    if (u.protocol === 'https:' && isLocalhostHost(u.hostname)) {
      u.protocol = 'http:';
      return u.toString();
    }
  } catch {
    // ignore: not a valid absolute URL
  }
  return url;
}

function isSslPacketLengthTooLong(err: unknown) {
  const anyErr = err as any;
  return anyErr?.cause?.code === 'ERR_SSL_PACKET_LENGTH_TOO_LONG';
}

export async function fetchAsBytes(url: string, init?: RequestInit) {
  const normalized = downgradeHttpsToHttpIfLocalhost(url);
  try {
    const res = await fetch(normalized, init);
    if (!res.ok) throw new Error(`Failed to fetch image: HTTP ${res.status}`);
    const mimeType = res.headers.get('content-type') ?? 'application/octet-stream';
    const ab = await res.arrayBuffer();
    return { bytes: new Uint8Array(ab), mimeType };
  } catch (err) {
    // If someone accidentally passed an https://localhost URL while the server is running on http,
    // Node's TLS layer throws ERR_SSL_PACKET_LENGTH_TOO_LONG (it receives plaintext HTTP).
    if (isSslPacketLengthTooLong(err)) {
      const downgraded = downgradeHttpsToHttpIfLocalhost(url);
      if (downgraded !== url) {
        const res = await fetch(downgraded, init);
        if (!res.ok) throw new Error(`Failed to fetch image: HTTP ${res.status}`);
        const mimeType = res.headers.get('content-type') ?? 'application/octet-stream';
        const ab = await res.arrayBuffer();
        return { bytes: new Uint8Array(ab), mimeType };
      }
    }
    throw err;
  }
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


