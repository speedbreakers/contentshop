import { createHmac, timingSafeEqual } from 'crypto';

function base64url(buf: Buffer) {
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

export function signDownloadToken(input: { fileId: number; exp: number }) {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error('AUTH_SECRET is required to sign download URLs');

  // Include teamId so signed URLs can be resolved without relying on session cookies.
  // (Callers must pass the same teamId as a query param when serving.)
  const teamId = (input as any).teamId;
  if (!Number.isFinite(teamId)) throw new Error('teamId is required to sign download URLs');

  const payload = `${input.fileId}.${teamId}.${input.exp}`;
  const mac = createHmac('sha256', secret).update(payload).digest();
  return base64url(mac);
}

export function verifyDownloadToken(input: { fileId: number; teamId: number; exp: number; sig: string }) {
  const secret = process.env.AUTH_SECRET;
  if (!secret) return false;
  if (!Number.isFinite(input.exp) || input.exp <= Date.now()) return false;
  if (!Number.isFinite(input.teamId)) return false;

  const payload = `${input.fileId}.${input.teamId}.${input.exp}`;
  const expected = createHmac('sha256', secret).update(payload).digest();

  // Compare against provided sig (base64url).
  const providedB64 = input.sig.replace(/-/g, '+').replace(/_/g, '/');
  const pad = providedB64.length % 4 === 0 ? '' : '='.repeat(4 - (providedB64.length % 4));
  let provided: Buffer;
  try {
    provided = Buffer.from(providedB64 + pad, 'base64');
  } catch {
    return false;
  }

  if (provided.length !== expected.length) return false;
  return timingSafeEqual(provided, expected);
}


