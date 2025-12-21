import { redirect } from 'next/navigation';
import { getUser } from '@/lib/db/queries';

export default async function HomePage() {
  const user = await getUser();
  if (user) {
    redirect('/dashboard/products');
  }

  // No homepage UI: if not logged in, render nothing.
  return null;
}
