import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { PAYROLL_HEADERS, payrollRows, toCsv } from '@/lib/exports';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) return new NextResponse('Unauthorized', { status: 401 });
  if (session.user.role !== 'ADMIN' && session.user.role !== 'HR') {
    return new NextResponse('Forbidden', { status: 403 });
  }
  const { id } = await params;
  const period = await prisma.payPeriod.findUnique({ where: { id } });
  if (!period) return new NextResponse('Not found', { status: 404 });

  const stubs = await prisma.payStub.findMany({
    where: { payPeriodId: id },
    include: { employee: true },
    orderBy: { employee: { lastName: 'asc' } },
  });

  const csv = toCsv(PAYROLL_HEADERS, payrollRows(stubs));

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="payroll-${period.startDate.toISOString().slice(0, 10)}.csv"`,
    },
  });
}
