import { NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { PayStubPdf } from '@/lib/pdf/PayStubPdf';
import { companyInfo } from '@/lib/company';
import { toNumber } from '@/lib/format';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) return new NextResponse('Unauthorized', { status: 401 });
  const { id } = await params;

  const stub = await prisma.payStub.findUnique({
    where: { id },
    include: { employee: true, payPeriod: true },
  });
  if (!stub) return new NextResponse('Not found', { status: 404 });

  const role = session.user.role;
  const isOwner = session.user.employeeId === stub.employeeId;
  if (role !== 'ADMIN' && role !== 'HR' && !isOwner) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  const e = stub.employee;
  const company = companyInfo();
  const buf = await renderToBuffer(
    <PayStubPdf
      company={company}
      employee={{
        employeeNumber: e.employeeNumber,
        name: `${e.firstName} ${e.lastName}`,
        ssn: e.ssn,
        address: [e.address, e.city, e.state, e.zipCode].filter(Boolean).join(', '),
      }}
      period={{
        startDate: stub.payPeriod.startDate,
        endDate: stub.payPeriod.endDate,
        payDate: stub.payPeriod.payDate,
      }}
      earnings={{
        regularHours: toNumber(stub.regularHours),
        overtimeHours: toNumber(stub.overtimeHours),
        regularPay: toNumber(stub.regularPay),
        overtimePay: toNumber(stub.overtimePay),
        bonusPay: toNumber(stub.bonusPay),
        commissionPay: toNumber(stub.commissionPay),
        reimbursements: toNumber(stub.reimbursements),
        grossPay: toNumber(stub.grossPay),
      }}
      deductions={{
        prIncomeTax: toNumber(stub.prIncomeTax),
        socialSecurity: toNumber(stub.socialSecurity),
        medicare: toNumber(stub.medicare),
        sinotEmployee: toNumber(stub.sinotEmployee),
        extraWithheld: toNumber(stub.extraWithheld),
        totalDeductions: toNumber(stub.totalDeductions),
      }}
      netPay={toNumber(stub.netPay)}
      ytd={{
        gross: toNumber(stub.ytdGross),
        net: toNumber(stub.ytdNet),
        prIncomeTax: toNumber(stub.ytdPrIncomeTax),
        socialSecurity: toNumber(stub.ytdSocialSecurity),
        medicare: toNumber(stub.ytdMedicare),
      }}
    />,
  );

  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="paystub-${e.employeeNumber}-${stub.id}.pdf"`,
    },
  });
}
