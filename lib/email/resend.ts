import { Resend } from 'resend';

export function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  return new Resend(apiKey);
}

export function getResendFrom(): string {
  const from = process.env.RESEND_FROM;
  if (!from) {
    throw new Error(
      'Missing RESEND_FROM. Set it to a verified sender, e.g. "Acme <[email protected]>"'
    );
  }
  return from;
}


