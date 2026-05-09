import { requireSession } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { fmtUSD } from "@/lib/money";
import Link from "next/link";

export default async function Dashboard() {
  const session = await requireSession();
  const role = session.user.role;

  if (role === "EMPLOYEE") {
    if (!session.user.employeeId) {
      return <p>Tu usuario no tiene un empleado asociado. Contacta a RRHH.</p>;
    }
    const last = await prisma.payStub.findFirst({
      where: { employeeId: session.user.employeeId },
      orderBy: { createdAt: "desc" },
      include: { payrollRun: { include: { payPeriod: true } } },
    });
    const ptoPending = await prisma.ptoRequest.count({
      where: { employeeId: session.user.employeeId, status: "PENDING" },
    });
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Hola, {session.user.name}</h1>
        <div className="grid md:grid-cols-3 gap-4">
          <div className="card">
            <p className="text-xs uppercase text-slate-500">Último pago neto</p>
            <p className="text-2xl font-bold mt-2">{last ? fmtUSD(last.netPay) : "—"}</p>
            {last && (
              <p className="text-xs text-slate-500 mt-1">
                Período {last.payrollRun.payPeriod.startDate.toISOString().slice(0, 10)} →{" "}
                {last.payrollRun.payPeriod.endDate.toISOString().slice(0, 10)}
              </p>
            )}
          </div>
          <div className="card">
            <p className="text-xs uppercase text-slate-500">Solicitudes PTO pendientes</p>
            <p className="text-2xl font-bold mt-2">{ptoPending}</p>
          </div>
          <div className="card">
            <p className="text-xs uppercase text-slate-500">Acciones rápidas</p>
            <div className="mt-2 flex flex-col gap-2">
              <Link className="btn-primary" href="/attendance">Time clock</Link>
              <Link className="btn-secondary" href="/pto">Solicitar PTO</Link>
              <Link className="btn-secondary" href="/me">Mis recibos</Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ADMIN / HR dashboard
  const [empCount, openPeriod, lastRun, pendingPto] = await Promise.all([
    prisma.employee.count({ where: { status: "ACTIVE" } }),
    prisma.payPeriod.findFirst({ where: { status: "OPEN" }, orderBy: { startDate: "desc" } }),
    prisma.payrollRun.findFirst({ orderBy: { processedAt: "desc" } }),
    prisma.ptoRequest.count({ where: { status: "PENDING" } }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <div className="grid md:grid-cols-4 gap-4">
        <Card label="Empleados activos" value={empCount} />
        <Card label="Período abierto"
              value={openPeriod ? `${openPeriod.startDate.toISOString().slice(0, 10)}` : "—"} />
        <Card label="Última nómina (neto)"
              value={lastRun ? fmtUSD(lastRun.totalNet) : "—"} />
        <Card label="PTO pendientes" value={pendingPto} />
      </div>
      <div className="card">
        <h2 className="font-semibold mb-3">Acciones</h2>
        <div className="flex flex-wrap gap-3">
          <Link href="/employees/new" className="btn-primary">+ Nuevo empleado</Link>
          <Link href="/payroll" className="btn-secondary">Ir a nómina</Link>
          <Link href="/reports" className="btn-secondary">Reportes</Link>
        </div>
      </div>
    </div>
  );
}

function Card({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="card">
      <p className="text-xs uppercase text-slate-500">{label}</p>
      <p className="text-2xl font-bold mt-2">{value}</p>
    </div>
  );
}
