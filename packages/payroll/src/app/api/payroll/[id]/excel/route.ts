import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { PAYROLL_HEADERS, payrollRows } from '@/lib/exports';

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
  const period = await prisma.payPeriod.findUnique({
    where: { id },
    include: { payrollRun: true },
  });
  if (!period) return new NextResponse('Not found', { status: 404 });

  const stubs = await prisma.payStub.findMany({
    where: { payPeriodId: id },
    include: { employee: true },
    orderBy: { employee: { lastName: 'asc' } },
  });

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Nómina');
  ws.addRow([`Período ${period.startDate.toISOString().slice(0, 10)} – ${period.endDate.toISOString().slice(0, 10)}`]);
  ws.addRow([`Pago: ${period.payDate.toISOString().slice(0, 10)}`]);
  ws.addRow([]);
  ws.addRow(PAYROLL_HEADERS);
  ws.getRow(4).font = { bold: true };
  for (const r of payrollRows(stubs)) ws.addRow(r);
  ws.columns.forEach((c) => {
    c.width = 18;
  });

  const buf = await wb.xlsx.writeBuffer();

  return new NextResponse(buf, {
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="payroll-${period.startDate.toISOString().slice(0, 10)}.xlsx"`,
    },
  });
}
