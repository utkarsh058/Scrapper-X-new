import { redirect } from 'next/navigation';
import { getAuthenticatedUserId } from '@/lib/auth/sessionService';
import DashboardClient from './DashboardClient';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    redirect('/login');
  }

  return <DashboardClient />;
}
