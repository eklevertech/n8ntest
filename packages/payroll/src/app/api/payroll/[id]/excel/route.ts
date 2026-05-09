import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { toNumber } from "@/lib/money";

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

  const wb = new ExcelJS.Workbook();
  wb.creator = "Payroll PR";
  wb.created = new Date();

  const ws = wb.addWorksheet("Payroll");
  ws.columns = [
    { header: "Empleado #", key: "num", width: 12 },
    { header: "Nombre", key: "name", width: 28 },
    { header: "Tipo", key: "type", width: 12 },
    { header: "Reg h", key: "rh", width: 8 },
    { header: "OT h", key: "oh", width: 8 },
    { header: "Reg pay", key: "rp", width: 12, style: { numFmt: '"$"#,##0.00' } },
    { header: "OT pay", key: "op", width: 12, style: { numFmt: '"$"#,##0.00' } },
    { header: "Bono", key: "bp", width: 12, style: { numFmt: '"$"#,##0.00' } },
    { header: "Comisión", key: "cp", width: 12, style: { numFmt: '"$"#,##0.00' } },
    { header: "Reembolso", key: "rmb", width: 12, style: { numFmt: '"$"#,##0.00' } },
    { header: "Gross", key: "g", width: 14, style: { numFmt: '"$"#,##0.00' } },
    { header: "PR Tax", key: "pr", width: 12, style: { numFmt: '"$"#,##0.00' } },
    { header: "SS", key: "ss", width: 10, style: { numFmt: '"$"#,##0.00' } },
    { header: "Medicare", key: "med", width: 10, style: { numFmt: '"$"#,##0.00' } },
    { header: "SINOT", key: "sin", width: 10, style: { numFmt: '"$"#,##0.00' } },
    { header: "Extra", key: "ex", width: 10, style: { numFmt: '"$"#,##0.00' } },
    { header: "Deducciones", key: "ded", width: 14, style: { numFmt: '"$"#,##0.00' } },
    { header: "Net", key: "net", width: 14, style: { numFmt: '"$"#,##0.00' } },
  ];
  ws.getRow(1).font = { bold: true };

  for (const s of period.payrollRun.payStubs) {
    ws.addRow({
      num: s.employee.employeeNumber,
      name: `${s.employee.firstName} ${s.employee.lastName}`,
      type: s.employee.employeeType,
      rh: toNumber(s.regularHours),
      oh: toNumber(s.overtimeHours),
      rp: toNumber(s.regularPay),
      op: toNumber(s.overtimePay),
      bp: toNumber(s.bonusPay),
      cp: toNumber(s.commissionPay),
      rmb: toNumber(s.reimbursements),
      g: toNumber(s.grossPay),
      pr: toNumber(s.prIncomeTax),
      ss: toNumber(s.socialSecurity),
      med: toNumber(s.medicare),
      sin: toNumber(s.sinotEmployee),
      ex: toNumber(s.extraWithheld),
      ded: toNumber(s.totalDeductions),
      net: toNumber(s.netPay),
    });
  }

  // Totals row
  const total = ws.addRow({
    num: "",
    name: "TOTAL",
    type: "",
    rh: { formula: `SUM(D2:D${period.payrollRun.payStubs.length + 1})` },
    oh: { formula: `SUM(E2:E${period.payrollRun.payStubs.length + 1})` },
    rp: { formula: `SUM(F2:F${period.payrollRun.payStubs.length + 1})` },
    op: { formula: `SUM(G2:G${period.payrollRun.payStubs.length + 1})` },
    bp: { formula: `SUM(H2:H${period.payrollRun.payStubs.length + 1})` },
    cp: { formula: `SUM(I2:I${period.payrollRun.payStubs.length + 1})` },
    rmb: { formula: `SUM(J2:J${period.payrollRun.payStubs.length + 1})` },
    g: { formula: `SUM(K2:K${period.payrollRun.payStubs.length + 1})` },
    pr: { formula: `SUM(L2:L${period.payrollRun.payStubs.length + 1})` },
    ss: { formula: `SUM(M2:M${period.payrollRun.payStubs.length + 1})` },
    med: { formula: `SUM(N2:N${period.payrollRun.payStubs.length + 1})` },
    sin: { formula: `SUM(O2:O${period.payrollRun.payStubs.length + 1})` },
    ex: { formula: `SUM(P2:P${period.payrollRun.payStubs.length + 1})` },
    ded: { formula: `SUM(Q2:Q${period.payrollRun.payStubs.length + 1})` },
    net: { formula: `SUM(R2:R${period.payrollRun.payStubs.length + 1})` },
  });
  total.font = { bold: true };

  const buffer = await wb.xlsx.writeBuffer();
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="payroll-${period.payDate.toISOString().slice(0,10)}.xlsx"`,
    },
  });
}
