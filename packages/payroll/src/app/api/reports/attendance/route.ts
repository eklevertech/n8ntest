import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { toNumber } from "@/lib/money";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "HR")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const format = url.searchParams.get("format") ?? "csv";
  if (!from || !to) return NextResponse.json({ error: "from/to requeridos" }, { status: 400 });

  const entries = await prisma.timeEntry.findMany({
    where: {
      date: { gte: new Date(from), lte: new Date(to) },
      hours: { not: null },
    },
    include: { employee: true },
    orderBy: [{ employee: { lastName: "asc" } }, { date: "asc" }],
  });

  const rows = entries.map((t) => ({
    employeeNumber: t.employee.employeeNumber,
    name: `${t.employee.firstName} ${t.employee.lastName}`,
    date: t.date.toISOString().slice(0, 10),
    clockIn: t.clockIn.toLocaleString(),
    clockOut: t.clockOut ? t.clockOut.toLocaleString() : "",
    hours: toNumber(t.hours),
    status: t.status,
    notes: t.notes ?? "",
  }));

  if (format === "xlsx") {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Asistencia");
    ws.columns = [
      { header: "Empleado #", key: "employeeNumber", width: 12 },
      { header: "Nombre", key: "name", width: 28 },
      { header: "Fecha", key: "date", width: 12 },
      { header: "Entrada", key: "clockIn", width: 22 },
      { header: "Salida", key: "clockOut", width: 22 },
      { header: "Horas", key: "hours", width: 8 },
      { header: "Estado", key: "status", width: 12 },
      { header: "Notas", key: "notes", width: 30 },
    ];
    ws.getRow(1).font = { bold: true };
    rows.forEach((r) => ws.addRow(r));

    const buf = await wb.xlsx.writeBuffer();
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="attendance-${from}-${to}.xlsx"`,
      },
    });
  }

  const headers = ["EmployeeNumber", "Name", "Date", "ClockIn", "ClockOut", "Hours", "Status", "Notes"];
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push([r.employeeNumber, r.name, r.date, r.clockIn, r.clockOut, r.hours, r.status, r.notes]
      .map((v) => {
        const s = String(v ?? "");
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      }).join(","));
  }
  return new NextResponse(lines.join("\n"), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="attendance-${from}-${to}.csv"`,
    },
  });
}
