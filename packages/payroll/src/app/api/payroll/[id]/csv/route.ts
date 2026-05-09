import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { toNumber } from "@/lib/money";

function csvEscape(v: unknown): string {
  const s = String(v ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "HR")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const period = await prisma.payPeriod.findUnique({
    where: { id: params.id },
    include: {
      payrollRun: {
        include: { payStubs: { include: { employee: true }, orderBy: { employee: { lastName: "asc" } } } },
      },
    },
  });
  if (!period?.payrollRun) return NextResponse.json({ error: "Not processed" }, { status: 400 });

  const headers = [
    "EmployeeNumber", "FirstName", "LastName", "Type",
    "RegularHours", "OvertimeHours",
    "RegularPay", "OvertimePay", "BonusPay", "CommissionPay", "Reimbursements",
    "GrossPay",
    "PRIncomeTax", "SocialSecurity", "Medicare", "SINOT", "ExtraWithheld",
    "TotalDeductions", "NetPay",
    "EmployerSS", "EmployerMedicare", "EmployerSINOT",
    "PeriodStart", "PeriodEnd", "PayDate",
  ];

  const lines = [headers.join(",")];
  for (const s of period.payrollRun.payStubs) {
    lines.push([
      s.employee.employeeNumber,
      s.employee.firstName,
      s.employee.lastName,
      s.employee.employeeType,
      toNumber(s.regularHours),
      toNumber(s.overtimeHours),
      toNumber(s.regularPay),
      toNumber(s.overtimePay),
      toNumber(s.bonusPay),
      toNumber(s.commissionPay),
      toNumber(s.reimbursements),
      toNumber(s.grossPay),
      toNumber(s.prIncomeTax),
      toNumber(s.socialSecurity),
      toNumber(s.medicare),
      toNumber(s.sinotEmployee),
      toNumber(s.extraWithheld),
      toNumber(s.totalDeductions),
      toNumber(s.netPay),
      toNumber(s.employerSS),
      toNumber(s.employerMedicare),
      toNumber(s.employerSinot),
      period.startDate.toISOString().slice(0, 10),
      period.endDate.toISOString().slice(0, 10),
      period.payDate.toISOString().slice(0, 10),
    ].map(csvEscape).join(","));
  }

  const csv = lines.join("\n");
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="payroll-${period.payDate.toISOString().slice(0,10)}.csv"`,
    },
  });
}
