import * as React from 'react';

export type TeamInviteEmailProps = {
  inviterName: string;
  teamName: string;
  role: string;
  inviteUrl: string;
};

export function TeamInviteEmail({
  inviterName,
  teamName,
  role,
  inviteUrl,
}: TeamInviteEmailProps) {
  return (
    <div style={{ fontFamily: 'Arial, sans-serif', lineHeight: 1.5 }}>
      <h1 style={{ margin: '0 0 12px' }}>You’ve been invited to join a team</h1>
      <p style={{ margin: '0 0 12px' }}>
        <strong>{inviterName}</strong> invited you to join <strong>{teamName}</strong> as{' '}
        <strong>{role}</strong>.
      </p>
      <p style={{ margin: '0 0 16px' }}>
        Click the button below to create your account and accept the invitation.
      </p>
      <p style={{ margin: '0 0 16px' }}>
        <a
          href={inviteUrl}
          style={{
            display: 'inline-block',
            background: '#ea580c',
            color: '#fff',
            padding: '10px 14px',
            borderRadius: 9999,
            textDecoration: 'none',
          }}
        >
          Accept invitation
        </a>
      </p>
      <p style={{ margin: 0, color: '#6b7280', fontSize: 12 }}>
        If you didn’t expect this invite, you can ignore this email.
      </p>
    </div>
  );
}


