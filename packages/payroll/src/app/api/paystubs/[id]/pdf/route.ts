import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { PayStubPDF, type PayStubData } from "@/lib/pdf/PayStubPDF";

function maskSSN(ssn: string | null | undefined): string {
  if (!ssn) return "—";
  const digits = ssn.replace(/\D/g, "");
  if (digits.length < 4) return "—";
  return `XXX-XX-${digits.slice(-4)}`;
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const stub = await prisma.payStub.findUnique({
    where: { id: params.id },
    include: { employee: true, payrollRun: { include: { payPeriod: true } } },
  });
  if (!stub) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Employees can only download their own stubs
  if (
    session.user.role === "EMPLOYEE" &&
    stub.employeeId !== session.user.employeeId
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const data: PayStubData = {
    company: {
      name: process.env.COMPANY_NAME ?? "Acme Corp",
      ein: process.env.COMPANY_EIN ?? "00-0000000",
      address: process.env.COMPANY_ADDRESS ?? "",
    },
    employee: {
      employeeNumber: stub.employee.employeeNumber,
      name: `${stub.employee.firstName} ${stub.employee.lastName}`,
      address: [stub.employee.address, stub.employee.city, stub.employee.zipCode]
        .filter(Boolean)
        .join(", "),
      ssnMasked: maskSSN(stub.employee.ssn),
    },
    period: {
      start: stub.payrollRun.payPeriod.startDate.toISOString().slice(0, 10),
      end: stub.payrollRun.payPeriod.endDate.toISOString().slice(0, 10),
      payDate: stub.payrollRun.payPeriod.payDate.toISOString().slice(0, 10),
    },
    earnings: {
      regularHours: stub.regularHours,
      overtimeHours: stub.overtimeHours,
      regularPay: stub.regularPay,
      overtimePay: stub.overtimePay,
      bonusPay: stub.bonusPay,
      commissionPay: stub.commissionPay,
      reimbursements: stub.reimbursements,
      grossPay: stub.grossPay,
    },
    deductions: {
      prIncomeTax: stub.prIncomeTax,
      socialSecurity: stub.socialSecurity,
      medicare: stub.medicare,
      sinotEmployee: stub.sinotEmployee,
      extraWithheld: stub.extraWithheld,
      totalDeductions: stub.totalDeductions,
    },
    ytd: {
      gross: stub.ytdGross,
      net: stub.ytdNet,
      prIncomeTax: stub.ytdPrIncomeTax,
      socialSecurity: stub.ytdSocialSecurity,
      medicare: stub.ytdMedicare,
    },
    netPay: stub.netPay,
  };

  const buffer = await renderToBuffer(<PayStubPDF data={data} />);
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="paystub-${stub.employee.employeeNumber}-${data.period.payDate}.pdf"`,
    },
  });
}
