import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return new NextResponse('Unauthorized', { status: 401 });
  if (session.user.role !== 'ADMIN' && session.user.role !== 'HR') {
    return new NextResponse('Forbidden', { status: 403 });
  }
  const url = new URL(req.url);
  const employeeId = url.searchParams.get('employeeId');
  const year = url.searchParams.get('year');
  if (!employeeId || !year) return new NextResponse('Missing params', { status: 400 });
  return NextResponse.redirect(
    new URL(`/api/reports/annual/${employeeId}?year=${year}`, req.url),
  );
}
