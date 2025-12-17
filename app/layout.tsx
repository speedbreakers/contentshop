import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Manrope } from 'next/font/google';
import { AppProviders } from '@/components/app-providers';
import { getTeamForUser, getUser } from '@/lib/db/queries';

export const metadata: Metadata = {
  title: 'Next.js SaaS Starter',
  description: 'Get started quickly with Next.js, Postgres, and Stripe.'
};

export const viewport: Viewport = {
  maximumScale: 1
};

const manrope = Manrope({ subsets: ['latin'] });

export default async function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  // Preload common session-bound data so initial client render doesn't waterfall.
  // Must be JSON-serializable because it's passed into a Client Component.
  const user = await getUser();
  const team = await getTeamForUser();
  const fallback = {
    '/api/user': user ? JSON.parse(JSON.stringify(user)) : null,
    '/api/team': team ? JSON.parse(JSON.stringify(team)) : null,
  };

  return (
    <html
      lang="en"
      className={`bg-sidebar text-black dark:text-white ${manrope.className}`}
      suppressHydrationWarning
    >
      <body className="min-h-[100dvh] bg-background">
        <AppProviders fallback={fallback}>{children}</AppProviders>
      </body>
    </html>
  );
}
