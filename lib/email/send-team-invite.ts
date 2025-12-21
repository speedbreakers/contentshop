import { getBaseUrl } from '@/lib/email/base-url';
import { getResendClient, getResendFrom } from '@/lib/email/resend';

function escapeHtml(input: string): string {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export async function sendTeamInviteEmail(input: {
  to: string;
  inviterName: string;
  teamName: string;
  role: string;
  inviteId: number;
}) {
  const baseUrl = getBaseUrl();
  const inviteUrl = `${baseUrl}/sign-up?inviteId=${encodeURIComponent(
    String(input.inviteId)
  )}`;

  const resend = getResendClient();
  if (!resend) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('RESEND_API_KEY is not set');
    }
    // Dev-friendly fallback so invites still work locally.
    console.warn('[invite-email] RESEND_API_KEY not set; skipping send', {
      to: input.to,
      inviteUrl,
    });
    return { skipped: true as const, inviteUrl };
  }

  const { data, error } = await resend.emails.send({
    from: getResendFrom(),
    to: [input.to],
    subject: `You’ve been invited to join ${input.teamName}`,
    text: `${input.inviterName} invited you to join ${input.teamName} as ${input.role}.\n\nAccept invitation: ${inviteUrl}\n\nIf you didn’t expect this invite, you can ignore this email.`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5;">
        <h1 style="margin: 0 0 12px;">You’ve been invited to join a team</h1>
        <p style="margin: 0 0 12px;">
          <strong>${escapeHtml(input.inviterName)}</strong> invited you to join
          <strong>${escapeHtml(input.teamName)}</strong> as <strong>${escapeHtml(
      input.role
    )}</strong>.
        </p>
        <p style="margin: 0 0 16px;">
          Click the button below to create your account and accept the invitation.
        </p>
        <p style="margin: 0 0 16px;">
          <a
            href="${escapeHtml(inviteUrl)}"
            style="display:inline-block;background:#ea580c;color:#fff;padding:10px 14px;border-radius:9999px;text-decoration:none;"
          >
            Accept invitation
          </a>
        </p>
        <p style="margin:0;color:#6b7280;font-size:12px;">
          If you didn’t expect this invite, you can ignore this email.
        </p>
      </div>
    `,
  });

  if (error) {
    throw new Error(
      typeof error === 'string' ? error : (error as any)?.message || 'Resend error'
    );
  }

  return { skipped: false as const, id: data?.id, inviteUrl };
}


