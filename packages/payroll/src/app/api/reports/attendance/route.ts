import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { toCsv } from '@/lib/exports';
import { toNumber } from '@/lib/format';

const HEADERS = ['Empleado', 'Núm', 'Fecha', 'Entrada', 'Salida', 'Horas', 'Status', 'Notas'];

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return new NextResponse('Unauthorized', { status: 401 });
  if (session.user.role !== 'ADMIN' && session.user.role !== 'HR') {
    return new NextResponse('Forbidden', { status: 403 });
  }
  const url = new URL(req.url);
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const format = (url.searchParams.get('format') ?? 'csv').toLowerCase();
  if (!from || !to) return new NextResponse('Missing from/to', { status: 400 });

  const entries = await prisma.timeEntry.findMany({
    where: {
      date: {
        gte: new Date(from),
        lte: new Date(to),
      },
    },
    include: {
      employee: { select: { firstName: true, lastName: true, employeeNumber: true } },
    },
    orderBy: [{ date: 'asc' }, { employeeId: 'asc' }],
  });

  const rows = entries.map((e) => [
    `${e.employee.lastName}, ${e.employee.firstName}`,
    e.employee.employeeNumber,
    e.date.toISOString().slice(0, 10),
    e.clockIn ? e.clockIn.toISOString() : '',
    e.clockOut ? e.clockOut.toISOString() : '',
    toNumber(e.hours),
    e.status,
    e.notes ?? '',
  ]);

  if (format === 'excel' || format === 'xlsx') {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Asistencia');
    ws.addRow([`Asistencia ${from} – ${to}`]);
    ws.addRow([]);
    ws.addRow(HEADERS);
    ws.getRow(3).font = { bold: true };
    for (const r of rows) ws.addRow(r);
    ws.columns.forEach((c) => (c.width = 18));
    const buf = await wb.xlsx.writeBuffer();
    return new NextResponse(buf, {
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="attendance-${from}-${to}.xlsx"`,
      },
    });
  }

  const csv = toCsv(HEADERS, rows);
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="attendance-${from}-${to}.csv"`,
    },
  });
}
