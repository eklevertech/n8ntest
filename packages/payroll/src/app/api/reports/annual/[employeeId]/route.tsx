import { NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { AnnualReportPdf } from '@/lib/pdf/AnnualReportPdf';
import { companyInfo } from '@/lib/company';
import { toNumber } from '@/lib/format';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ employeeId: string }> },
) {
  const session = await auth();
  if (!session?.user) return new NextResponse('Unauthorized', { status: 401 });
  const { employeeId } = await params;
  const role = session.user.role;
  if (role !== 'ADMIN' && role !== 'HR' && session.user.employeeId !== employeeId) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  const url = new URL(req.url);
  const year = Number(url.searchParams.get('year') ?? new Date().getUTCFullYear());

  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee) return new NextResponse('Not found', { status: 404 });

  const yearStart = new Date(Date.UTC(year, 0, 1));
  const yearEnd = new Date(Date.UTC(year + 1, 0, 1));
  const stubs = await prisma.payStub.findMany({
    where: {
      employeeId,
      payPeriod: { payDate: { gte: yearStart, lt: yearEnd } },
    },
  });

  const grossWages = stubs.reduce((s, x) => s + toNumber(x.grossPay), 0);
  const reimbursements = stubs.reduce((s, x) => s + toNumber(x.reimbursements), 0);
  const taxableWages = grossWages - reimbursements;
  const totals = {
    grossWages,
    prIncomeTax: stubs.reduce((s, x) => s + toNumber(x.prIncomeTax), 0),
    socialSecurityWages: taxableWages,
    socialSecurityTax: stubs.reduce((s, x) => s + toNumber(x.socialSecurity), 0),
    medicareWages: taxableWages,
    medicareTax: stubs.reduce((s, x) => s + toNumber(x.medicare), 0),
  };

  const buf = await renderToBuffer(
    <AnnualReportPdf
      kind={employee.employeeType === 'CONTRACTOR' ? 'FORM_1099' : 'W2PR'}
      year={year}
      company={companyInfo()}
      employee={{
        name: `${employee.firstName} ${employee.lastName}`,
        ssn: employee.ssn,
        employeeNumber: employee.employeeNumber,
        address: [employee.address, employee.city, employee.state, employee.zipCode]
          .filter(Boolean)
          .join(', '),
      }}
      totals={totals}
    />,
  );

  const label = employee.employeeType === 'CONTRACTOR' ? '1099' : 'W2PR';
  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${label}-${employee.employeeNumber}-${year}.pdf"`,
    },
  });
}
