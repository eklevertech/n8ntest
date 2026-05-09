import { redirect } from 'next/navigation';
import type { Role } from '@prisma/client';
import { auth } from './auth';

export async function requireSession() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  return session;
}

export async function requireRole(roles: Role[]) {
  const session = await requireSession();
  if (!roles.includes(session.user.role)) {
    redirect('/');
  }
  return session;
}

export async function getSession() {
  return auth();
}
