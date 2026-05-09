import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { AnnualPDF, type AnnualData } from "@/lib/pdf/AnnualPDF";
import { toNumber } from "@/lib/money";

function maskSSN(ssn: string | null | undefined): string {
  if (!ssn) return "—";
  const digits = ssn.replace(/\D/g, "");
  if (digits.length < 4) return "—";
  return `XXX-XX-${digits.slice(-4)}`;
}

export async function GET(req: Request, { params }: { params: { employeeId: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const isStaff = session.user.role === "ADMIN" || session.user.role === "HR";
  if (!isStaff && session.user.employeeId !== params.employeeId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const year = Number(url.searchParams.get("year") ?? new Date().getFullYear());

  const employee = await prisma.employee.findUnique({ where: { id: params.employeeId } });
  if (!employee) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year + 1, 0, 1);

  const agg = await prisma.payStub.aggregate({
    where: {
      employeeId: employee.id,
      payrollRun: { payPeriod: { startDate: { gte: yearStart, lt: yearEnd } } },
    },
    _sum: {
      grossPay: true,
      netPay: true,
      prIncomeTax: true,
      socialSecurity: true,
      medicare: true,
      sinotEmployee: true,
    },
  });

  const data: AnnualData = {
    year,
    isContractor: employee.employeeType === "CONTRACTOR",
    company: {
      name: process.env.COMPANY_NAME ?? "Acme Corp",
      ein: process.env.COMPANY_EIN ?? "00-0000000",
      address: process.env.COMPANY_ADDRESS ?? "",
    },
    employee: {
      name: `${employee.firstName} ${employee.lastName}`,
      employeeNumber: employee.employeeNumber,
      address: [employee.address, employee.city, employee.zipCode].filter(Boolean).join(", "),
      ssnMasked: maskSSN(employee.ssn),
    },
    totals: {
      gross: toNumber(agg._sum.grossPay ?? 0),
      net: toNumber(agg._sum.netPay ?? 0),
      prIncomeTax: toNumber(agg._sum.prIncomeTax ?? 0),
      socialSecurity: toNumber(agg._sum.socialSecurity ?? 0),
      medicare: toNumber(agg._sum.medicare ?? 0),
      sinotEmployee: toNumber(agg._sum.sinotEmployee ?? 0),
    },
  };

  const buf = await renderToBuffer(<AnnualPDF data={data} />);
  const formName = data.isContractor ? "1099" : "W2PR";
  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${formName}-${employee.employeeNumber}-${year}.pdf"`,
    },
  });
}
